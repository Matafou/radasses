-- Tests pgTAP : compute_split, save_expense et la vue balances.
-- Lancé par `supabase test db`. Chaque fichier tourne dans une transaction
-- annulée à la fin -> aucune donnée persistée.

begin;
create extension if not exists pgtap;
select plan(10);

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

-- 3) Pourcentages 50/30/20 sur 100,00 €.
select is(
	(compute_split(10000, format('[{"person_id":"%s","percent":50},{"person_id":"%s","percent":30},{"person_id":"%s","percent":20}]', :'A', :'B', :'C')::jsonb) -> 0 ->> 'amount_cents')::int,
	5000, 'pourcentage 50%% -> 5000'
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
insert into trip_participants (trip_id, person_id, household_id, default_percent) values
	(:'TR', :'AL', :'HD', 25), (:'TR', :'BO', :'HD', 25),
	(:'TR', :'CH', :'HD', 25), (:'TR', :'ZO', :'HZ', 25);

-- mêmes 4 dépenses que l'exemple
select save_expense(:'TR', 6000, :'AL',
	format('[{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"}]', :'AL',:'BO',:'CH',:'ZO')::jsonb);
select save_expense(:'TR', 10000, :'ZO',
	format('[{"person_id":"%s"},{"person_id":"%s"},{"person_id":"%s"}]', :'AL',:'BO',:'ZO')::jsonb);
select save_expense(:'TR', 3000, :'BO',
	format('[{"person_id":"%s"}]', :'CH')::jsonb);
select save_expense(:'TR', 5000, :'AL',
	format('[{"person_id":"%s","is_locked":true,"amount_cents":2000},{"person_id":"%s"},{"person_id":"%s"}]', :'ZO',:'AL',:'BO')::jsonb);

-- 7-8) Soldes attendus : Dupont -3167, Zoé +3167.
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HD'),
	-3167::bigint, 'solde Foyer Dupont = -3167');
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HZ'),
	3167::bigint, 'solde Foyer Zoé = +3167');

-- Règlement : Dupont verse 31,67 € à Zoé -> les deux soldes reviennent à 0.
insert into settlements (trip_id, from_household_id, to_household_id, amount_cents)
	values (:'TR', :'HD', :'HZ', 3167);

-- 9-10)
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HD'),
	0::bigint, 'après règlement : Dupont = 0');
select is((select net_cents from balances where trip_id = :'TR' and household_id = :'HZ'),
	0::bigint, 'après règlement : Zoé = 0');

select * from finish();
rollback;
