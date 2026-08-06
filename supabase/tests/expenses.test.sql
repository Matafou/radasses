-- Tests pgTAP d'INTÉGRATION : vue balances, save_expense (verrou optimiste) et
-- delete_expense. Lancé par `supabase test db`. Chaque fichier tourne dans une
-- transaction annulée à la fin -> aucune donnée persistée.
--
-- NB : les cas PURS de compute_split (répartition seule) sont dans le fichier
-- GÉNÉRÉ `split_generated.test.sql` (source : src/lib/split.cases.ts), partagé
-- avec le test TS `previewSplit` pour empêcher toute dérive entre les deux.

begin;
create extension if not exists pgtap;
select plan(8);

-- ---------------------------------------------------------------------
--  Scénario complet pour la vue balances
--  le foyer Dupont = Alice, Bob, Chloé ; le foyer Zoé = Zoé.
-- ---------------------------------------------------------------------
\set AL 'aaaa0000-0000-0000-0000-0000000000a1'
\set BO 'aaaa0000-0000-0000-0000-0000000000b2'
\set CH 'aaaa0000-0000-0000-0000-0000000000c3'
\set ZO 'aaaa0000-0000-0000-0000-0000000000d4'
\set HD 'aaaa0000-0000-0000-0000-0000000000f1'
\set HZ 'aaaa0000-0000-0000-0000-0000000000f2'
\set TR 'aaaa0000-0000-0000-0000-0000000000e1'

insert into households (id, name) values (:'HD', 'Dupont'), (:'HZ', 'Zoé');
insert into persons (id, name) values (:'AL','Alice'),(:'BO','Bob'),(:'CH','Chloé'),(:'ZO','Zoé');
insert into trips (id, name) values (:'TR', 'Été test');
insert into trip_participants (trip_id, person_id, household_id, default_weight) values
	(:'TR', :'AL', :'HD', 1), (:'TR', :'BO', :'HD', 1),
	(:'TR', :'CH', :'HD', 1), (:'TR', :'ZO', :'HZ', 1);

-- quatre dépenses de l'exemple (parts égales + un montant verrouillé)
select save_expense(:'TR', 6000, :'AL',
	format('[{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"}]', :'AL',:'BO',:'CH',:'ZO')::jsonb);
select save_expense(:'TR', 10000, :'ZO',
	format('[{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"}]', :'AL',:'BO',:'ZO')::jsonb);
select save_expense(:'TR', 3000, :'BO',
	format('[{"person_id":"%s"}]', :'CH')::jsonb);
select save_expense(:'TR', 5000, :'AL',
	format('[{"person_id":"%s","is_locked":true,"amount_cents":2000},{"person_id":"%s"},{"person_id":"%s"}]', :'ZO',:'AL',:'BO')::jsonb);

-- 1-2) Soldes attendus : Dupont -3167, Zoé +3167 (payé - dû, par foyer).
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HD'),
	-3167::bigint, 'solde du foyer Dupont = -3167');
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HZ'),
	3167::bigint, 'solde du foyer Zoé = +3167');

-- ---------------------------------------------------------------------
--  Verrou optimiste (save_expense) — conflit levé en SQLSTATE PT409
--  (et NON 40001 serialization_failure, que PostgREST réessaierait en boucle).
-- ---------------------------------------------------------------------
-- crée une dépense (version 1) et récupère son id
select (save_expense(:'TR', 1000, :'AL',
	format('[{"person_id":"%s"},{"person_id":"%s"}]', :'AL', :'BO')::jsonb) ->> 'expense_id') as eid \gset

-- 3) mise à jour avec une mauvaise version -> conflit (errcode PT409)
select throws_ok(
	format($$ select save_expense('%s', 1000, '%s', '[{"person_id":"%s"},{"person_id":"%s"}]'::jsonb, '', null, null, '%s', 999) $$,
		:'TR', :'AL', :'AL', :'BO', :'eid'),
	'PT409'
);

-- 4) mise à jour avec la bonne version -> OK, version passe à 2
select is(
	(save_expense(:'TR', 1000, :'AL',
		format('[{"person_id":"%s"},{"person_id":"%s"}]', :'AL', :'BO')::jsonb,
		'', null, null, :'eid', 1) ->> 'version')::int,
	2, 'verrou optimiste : bonne version -> version 2'
);

-- ---------------------------------------------------------------------
--  Suppression logique (delete_expense) — la dépense eid est en version 2
-- ---------------------------------------------------------------------

-- 5) suppression avec mauvaise version -> conflit (PT409)
select throws_ok(
	format($$ select delete_expense('%s', '%s', 999) $$, :'TR', :'eid'),
	'PT409'
);

-- 6) suppression avec la bonne version -> deleted = true
select is(
	(delete_expense(:'TR', :'eid', 2) ->> 'deleted')::boolean,
	true, 'delete_expense : suppression OK'
);

-- 7) l'opération de suppression est journalisée (avec état complet en before)
select is(
	(select count(*) from operations
	 where entity_type = 'expense' and action = 'delete' and entity_id = :'eid'
	   and before is not null)::int,
	1, 'delete_expense : opération journalisée'
);

-- 8) re-supprimer -> rejeté (déjà supprimée)
select throws_ok(
	format($$ select delete_expense('%s', '%s') $$, :'TR', :'eid'),
	'P0001'
);

select * from finish();
rollback;
