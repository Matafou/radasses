-- =====================================================================
--  Exemple pré-rempli (chargé par `supabase db reset`)
--  Séjour « Été » :
--    Foyer Dupont = Alice, Bob, Chloé (enfant)
--    Foyer Zoé    = Zoé (foyer d'une personne)
--  4 dépenses illustrant les modes de répartition.
--  Exécuté en tant que postgres -> auth.uid() NULL -> save_expense OK.
-- =====================================================================

insert into households (id, name) values
	('00000000-0000-0000-0000-0000000000f1', 'Foyer Dupont'),
	('00000000-0000-0000-0000-0000000000f2', 'Foyer Zoé');

insert into persons (id, name) values
	('00000000-0000-0000-0000-0000000000a1', 'Alice'),
	('00000000-0000-0000-0000-0000000000b2', 'Bob'),
	('00000000-0000-0000-0000-0000000000c3', 'Chloé'),
	('00000000-0000-0000-0000-0000000000d4', 'Zoé');

insert into trips (id, name, currency) values
	('00000000-0000-0000-0000-0000000000e1', 'Été', 'EUR');

-- Chacun participe, rattaché à son foyer, poids par défaut égal (1).
insert into trip_participants (trip_id, person_id, household_id, default_weight) values
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 1),
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', 1),
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000f1', 1),
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000f2', 1);

-- 1) Courses 60,00 € payées par Alice, parts égales entre les 4.
select save_expense(
	'00000000-0000-0000-0000-0000000000e1', 6000, '00000000-0000-0000-0000-0000000000a1',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},
	  {"person_id":"00000000-0000-0000-0000-0000000000b2"},
	  {"person_id":"00000000-0000-0000-0000-0000000000c3"},
	  {"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Courses', 'Alimentation', date '2026-07-15');

-- 2) Restaurant 100,00 € payé par Zoé, entre les adultes (Alice, Bob, Zoé).
select save_expense(
	'00000000-0000-0000-0000-0000000000e1', 10000, '00000000-0000-0000-0000-0000000000d4',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},
	  {"person_id":"00000000-0000-0000-0000-0000000000b2"},
	  {"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Restaurant', 'Restaurant', date '2026-07-16');

-- 3) Activité enfant 30,00 € payée par Bob, pour Chloé uniquement.
select save_expense(
	'00000000-0000-0000-0000-0000000000e1', 3000, '00000000-0000-0000-0000-0000000000b2',
	'[{"person_id":"00000000-0000-0000-0000-0000000000c3"}]'::jsonb,
	'Activité enfant', 'Loisirs', date '2026-07-17');

-- 4) Taxi 50,00 € payé par Alice : Zoé fixée à 20,00 € (verrouillé),
--    le reste (30,00 €) partagé entre Alice et Bob.
select save_expense(
	'00000000-0000-0000-0000-0000000000e1', 5000, '00000000-0000-0000-0000-0000000000a1',
	'[{"person_id":"00000000-0000-0000-0000-0000000000d4","is_locked":true,"amount_cents":2000},
	  {"person_id":"00000000-0000-0000-0000-0000000000a1"},
	  {"person_id":"00000000-0000-0000-0000-0000000000b2"}]'::jsonb,
	'Taxi', 'Transport', date '2026-07-18');
