-- Tests pgTAP : compute_split, save_expense (verrou optimiste) et vue balances.
-- Lancé par `supabase test db`. Chaque fichier tourne dans une transaction
-- annulée à la fin -> aucune donnée persistée.

begin;
create extension if not exists pgtap;
select plan(17);

-- Personnes fictives pour les tests PURS de compute_split (aucune table touchée)
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'

-- 1) Parts égales 10 centimes / 3 : plus grands restes -> 4 au premier.
select is(
	(compute_split(10, format('[{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"}]', :'A', :'B', :'C')::jsonb) -> 0 ->> 'amount_cents')::int,
	4, '10c/3 : premier bénéficiaire = 4'
);

-- 2) La somme des parts égale toujours le total.
select is(
	(select sum((v->>'amount_cents')::int)
	 from jsonb_array_elements(
	   compute_split(10, format('[{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"}]', :'A', :'B', :'C')::jsonb)
	 ) v),
	10::bigint, '10c/3 : somme = total'
);

-- 3) Poids 50/30/20 sur 100,00 €.
select is(
	(compute_split(10000, format('[{"person_id":"%s","weight":50},{"person_id":"%s","weight":30},{"person_id":"%s","weight":20}]', :'A', :'B', :'C')::jsonb) -> 0 ->> 'amount_cents')::int,
	5000, 'poids 50 -> 5000'
);

-- 4) Montant verrouillé conservé + reste partagé sur les non-verrouillés.
select is(
	(compute_split(5000, format('[{"person_id":"%s","is_locked":true,"amount_cents":2000},{"person_id":"%s"},{"person_id":"%s"}]', :'A', :'B', :'C')::jsonb) -> 1 ->> 'amount_cents')::int,
	1500, 'verrouillé 2000 -> non-verrouillés à 1500'
);

-- 5) Rejet : tout verrouillé (pas de tampon).
select throws_ok(
	format($$ select compute_split(10000, '[{"person_id":"%s","is_locked":true,"amount_cents":5000},{"person_id":"%s","is_locked":true,"amount_cents":5000}]'::jsonb) $$, :'A', :'B'),
	'P0001'
);

-- 6) Rejet : verrouillés > total.
select throws_ok(
	format($$ select compute_split(1000, '[{"person_id":"%s","is_locked":true,"amount_cents":5000},{"person_id":"%s"}]'::jsonb) $$, :'A', :'B'),
	'P0001'
);

-- 7) Rejet : mélange de poids (un avec poids, un sans) -> tout ou rien.
select throws_ok(
	format($$ select compute_split(10000, '[{"person_id":"%s","weight":50},{"person_id":"%s"}]'::jsonb) $$, :'A', :'B'),
	'P0001'
);

-- ---------------------------------------------------------------------
--  Scénario complet pour la vue balances (uuids distincts du seed)
--  Foyer Dupont = Alice, Bob, Chloé ; Foyer Zoé = Zoé.
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

-- mêmes 4 dépenses que l'exemple (parts égales)
select save_expense(:'TR', 6000, :'AL',
	format('[{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"}]', :'AL',:'BO',:'CH',:'ZO')::jsonb);
select save_expense(:'TR', 10000, :'ZO',
	format('[{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"}]', :'AL',:'BO',:'ZO')::jsonb);
select save_expense(:'TR', 3000, :'BO',
	format('[{"person_id":"%s"}]', :'CH')::jsonb);
select save_expense(:'TR', 5000, :'AL',
	format('[{"person_id":"%s","is_locked":true,"amount_cents":2000},{"person_id":"%s"},{"person_id":"%s"}]', :'ZO',:'AL',:'BO')::jsonb);

-- 8-9) Soldes attendus : Dupont -3167, Zoé +3167.
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HD'),
	-3167::bigint, 'solde Foyer Dupont = -3167');
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HZ'),
	3167::bigint, 'solde Foyer Zoé = +3167');

-- Règlement : Dupont verse 31,67 € à Zoé -> les deux soldes reviennent à 0.
insert into settlements (trip_id, from_household_id, to_household_id, amount_cents)
	values (:'TR', :'HD', :'HZ', 3167);

-- 10-11)
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HD'),
	0::bigint, 'après règlement : Dupont = 0');
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HZ'),
	0::bigint, 'après règlement : Zoé = 0');

-- ---------------------------------------------------------------------
--  Verrou optimiste
-- ---------------------------------------------------------------------
-- crée une dépense (version 1) et récupère son id
select (save_expense(:'TR', 1000, :'AL',
	format('[{"person_id":"%s"},{"person_id":"%s"}]', :'AL', :'BO')::jsonb) ->> 'expense_id') as eid \gset

-- 12) mise à jour avec une mauvaise version -> conflit (errcode 40001)
select throws_ok(
	format($$ select save_expense('%s', 1000, '%s', '[{"person_id":"%s"},{"person_id":"%s"}]'::jsonb, '', null, null, '%s', 999) $$,
		:'TR', :'AL', :'AL', :'BO', :'eid'),
	'40001'
);

-- 13) mise à jour avec la bonne version -> OK, version passe à 2
select is(
	(save_expense(:'TR', 1000, :'AL',
		format('[{"person_id":"%s"},{"person_id":"%s"}]', :'AL', :'BO')::jsonb,
		'', null, null, :'eid', 1) ->> 'version')::int,
	2, 'verrou optimiste : bonne version -> version 2'
);

-- ---------------------------------------------------------------------
--  Suppression logique (delete_expense) — la dépense eid est en version 2
-- ---------------------------------------------------------------------

-- 14) suppression avec mauvaise version -> conflit (40001)
select throws_ok(
	format($$ select delete_expense('%s', '%s', 999) $$, :'TR', :'eid'),
	'40001'
);

-- 15) suppression avec la bonne version -> deleted = true
select is(
	(delete_expense(:'TR', :'eid', 2) ->> 'deleted')::boolean,
	true, 'delete_expense : suppression OK'
);

-- 16) l'opération de suppression est journalisée (avec état complet en before)
select is(
	(select count(*) from operations
	 where entity_type = 'expense' and action = 'delete' and entity_id = :'eid'
	   and before is not null)::int,
	1, 'delete_expense : opération journalisée'
);

-- 17) re-supprimer -> rejeté (déjà supprimée)
select throws_ok(
	format($$ select delete_expense('%s', '%s') $$, :'TR', :'eid'),
	'P0001'
);

select * from finish();
rollback;
