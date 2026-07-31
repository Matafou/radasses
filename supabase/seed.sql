-- =====================================================================
--  Données de démo (chargées par `supabase db reset` / `supabase start`).
--  Exécuté en tant que postgres -> auth.uid() NULL -> save_expense OK
--  (assert_trip_access tolère l'accès direct de confiance, cf. migration 0007).
--
--  ⚠️ ACCÈS : un séjour n'est visible dans l'app que pour l'utilisateur rattaché
--  (participant_access ← auth.uid() anonyme, propre à CHAQUE navigateur). Le seed
--  ne peut pas connaître ton uid → on fixe un jeton d'invitation stable et tu
--  ouvres le lien UNE FOIS après un reset pour te rattacher :
--
--     Été       →  http://localhost:5173/?token=demo-ete   (tu deviens Alice)
--     Week-end  →  http://localhost:5173/?token=demo-we    (tu deviens Marie)
--
--  (à refaire une fois par navigateur / après chaque `db reset`.)
-- =====================================================================

-- ---------------------------------------------------------------------
--  Séjour « Été » — Foyer Dupont (Alice, Bob, Chloé) + Foyer Zoé (Zoé)
-- ---------------------------------------------------------------------
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

insert into trip_participants (trip_id, person_id, household_id, default_weight) values
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 1),
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', 1),
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000f1', 1),
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000f2', 1);

-- jeton d'invitation stable pour se rattacher en tant qu'Alice
update trip_participants set invite_token = 'demo-ete'
	where trip_id = '00000000-0000-0000-0000-0000000000e1'
	  and person_id = '00000000-0000-0000-0000-0000000000a1';

-- ~11 dépenses illustrant les modes de répartition.
-- 1) Courses 60,00 € — Alice, parts égales entre les 4.
select save_expense('00000000-0000-0000-0000-0000000000e1', 6000, '00000000-0000-0000-0000-0000000000a1',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"},{"person_id":"00000000-0000-0000-0000-0000000000c3"},{"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Courses', 'Alimentation', date '2026-07-12');

-- 2) Restaurant 100,00 € — Zoé, entre les adultes (Alice, Bob, Zoé).
select save_expense('00000000-0000-0000-0000-0000000000e1', 10000, '00000000-0000-0000-0000-0000000000d4',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"},{"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Restaurant', 'Restaurant', date '2026-07-13');

-- 3) Activité enfant 30,00 € — Bob, pour Chloé uniquement.
select save_expense('00000000-0000-0000-0000-0000000000e1', 3000, '00000000-0000-0000-0000-0000000000b2',
	'[{"person_id":"00000000-0000-0000-0000-0000000000c3"}]'::jsonb,
	'Activité enfant', 'Loisirs', date '2026-07-14');

-- 4) Taxi 50,00 € — Alice ; Zoé fixée à 20,00 €, le reste partagé Alice+Bob.
select save_expense('00000000-0000-0000-0000-0000000000e1', 5000, '00000000-0000-0000-0000-0000000000a1',
	'[{"person_id":"00000000-0000-0000-0000-0000000000d4","is_locked":true,"amount_cents":2000},{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"}]'::jsonb,
	'Taxi', 'Transport', date '2026-07-15');

-- 5) Essence 80,00 € — Bob, parts égales entre les 4.
select save_expense('00000000-0000-0000-0000-0000000000e1', 8000, '00000000-0000-0000-0000-0000000000b2',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"},{"person_id":"00000000-0000-0000-0000-0000000000c3"},{"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Essence', 'Transport', date '2026-07-16');

-- 6) Location vélos 45,00 € — Zoé, entre les adultes.
select save_expense('00000000-0000-0000-0000-0000000000e1', 4500, '00000000-0000-0000-0000-0000000000d4',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"},{"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Location vélos', 'Loisirs', date '2026-07-17');

-- 7) Glaces 12,00 € — Alice, parts égales entre les 4.
select save_expense('00000000-0000-0000-0000-0000000000e1', 1200, '00000000-0000-0000-0000-0000000000a1',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"},{"person_id":"00000000-0000-0000-0000-0000000000c3"},{"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Glaces', 'Alimentation', date '2026-07-17');

-- 8) Musée 36,00 € — Bob, au poids (adultes 2, enfant 1).
select save_expense('00000000-0000-0000-0000-0000000000e1', 3600, '00000000-0000-0000-0000-0000000000b2',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1","weight":2},{"person_id":"00000000-0000-0000-0000-0000000000b2","weight":2},{"person_id":"00000000-0000-0000-0000-0000000000c3","weight":1},{"person_id":"00000000-0000-0000-0000-0000000000d4","weight":2}]'::jsonb,
	'Musée', 'Culture', date '2026-07-18');

-- 9) Marché 24,50 € — Zoé, parts égales entre les 4.
select save_expense('00000000-0000-0000-0000-0000000000e1', 2450, '00000000-0000-0000-0000-0000000000d4',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"},{"person_id":"00000000-0000-0000-0000-0000000000c3"},{"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Marché', 'Alimentation', date '2026-07-19');

-- 10) Parking 8,00 € — Alice, partagé Alice+Bob.
select save_expense('00000000-0000-0000-0000-0000000000e1', 800, '00000000-0000-0000-0000-0000000000a1',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"}]'::jsonb,
	'Parking', 'Transport', date '2026-07-20');

-- 11) Remboursement 15,00 € — Bob rembourse Zoé (un remboursement = une dépense).
select save_expense('00000000-0000-0000-0000-0000000000e1', 1500, '00000000-0000-0000-0000-0000000000b2',
	'[{"person_id":"00000000-0000-0000-0000-0000000000d4"}]'::jsonb,
	'Remboursement à Zoé', 'Remboursement', date '2026-07-21');

-- --- Foyer David (une seule personne) + dépenses qui le concernent ---
insert into households (id, name) values
	('00000000-0000-0000-0000-0000000000f5', 'Foyer David');
insert into persons (id, name) values
	('00000000-0000-0000-0000-0000000000d5', 'David');
insert into trip_participants (trip_id, person_id, household_id, default_weight) values
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000f5', 1);

-- 12) Apéro 40,00 € — David, parts égales entre les 5.
select save_expense('00000000-0000-0000-0000-0000000000e1', 4000, '00000000-0000-0000-0000-0000000000d5',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"},{"person_id":"00000000-0000-0000-0000-0000000000c3"},{"person_id":"00000000-0000-0000-0000-0000000000d4"},{"person_id":"00000000-0000-0000-0000-0000000000d5"}]'::jsonb,
	'Apéro', 'Alimentation', date '2026-07-22');

-- 13) Concert 90,00 € — Alice, entre les adultes (Alice, Bob, Zoé, David).
select save_expense('00000000-0000-0000-0000-0000000000e1', 9000, '00000000-0000-0000-0000-0000000000a1',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1"},{"person_id":"00000000-0000-0000-0000-0000000000b2"},{"person_id":"00000000-0000-0000-0000-0000000000d4"},{"person_id":"00000000-0000-0000-0000-0000000000d5"}]'::jsonb,
	'Concert', 'Culture', date '2026-07-23');

-- 14) Petit-déjeuner 25,00 € — David, pour David et Chloé.
select save_expense('00000000-0000-0000-0000-0000000000e1', 2500, '00000000-0000-0000-0000-0000000000d5',
	'[{"person_id":"00000000-0000-0000-0000-0000000000d5"},{"person_id":"00000000-0000-0000-0000-0000000000c3"}]'::jsonb,
	'Petit-déjeuner', 'Alimentation', date '2026-07-24');

-- 15) Grosse sortie 150,00 € — Alice ; TOUT LE MONDE bénéficiaire mais avec un
--     montant DIFFÉRENT chacun (poids 1→5 = 10/20/30/40/50 €) → illustre la ligne
--     de bénéficiaires scrollable (5 groupes distincts).
select save_expense('00000000-0000-0000-0000-0000000000e1', 15000, '00000000-0000-0000-0000-0000000000a1',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a1","weight":1},{"person_id":"00000000-0000-0000-0000-0000000000b2","weight":2},{"person_id":"00000000-0000-0000-0000-0000000000c3","weight":3},{"person_id":"00000000-0000-0000-0000-0000000000d4","weight":4},{"person_id":"00000000-0000-0000-0000-0000000000d5","weight":5}]'::jsonb,
	'Grosse sortie', 'Divers', date '2026-07-25');

-- ---------------------------------------------------------------------
--  Séjour « Week-end » — Foyer Martin (Marie, Paul) + Foyer Sofia (Sofia)
-- ---------------------------------------------------------------------
insert into households (id, name) values
	('00000000-0000-0000-0000-0000000000f3', 'Foyer Martin'),
	('00000000-0000-0000-0000-0000000000f4', 'Foyer Sofia');

insert into persons (id, name) values
	('00000000-0000-0000-0000-0000000000a5', 'Marie'),
	('00000000-0000-0000-0000-0000000000b6', 'Paul'),
	('00000000-0000-0000-0000-0000000000c7', 'Sofia');

insert into trips (id, name, currency) values
	('00000000-0000-0000-0000-0000000000e2', 'Week-end', 'EUR');

insert into trip_participants (trip_id, person_id, household_id, default_weight) values
	('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000f3', 1),
	('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000f3', 1),
	('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000f4', 1);

update trip_participants set invite_token = 'demo-we'
	where trip_id = '00000000-0000-0000-0000-0000000000e2'
	  and person_id = '00000000-0000-0000-0000-0000000000a5';

-- 1) Hôtel 120,00 € — Marie, parts égales entre les 3.
select save_expense('00000000-0000-0000-0000-0000000000e2', 12000, '00000000-0000-0000-0000-0000000000a5',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a5"},{"person_id":"00000000-0000-0000-0000-0000000000b6"},{"person_id":"00000000-0000-0000-0000-0000000000c7"}]'::jsonb,
	'Hôtel', 'Hébergement', date '2026-08-08');

-- 2) Dîner 45,00 € — Sofia, parts égales entre les 3.
select save_expense('00000000-0000-0000-0000-0000000000e2', 4500, '00000000-0000-0000-0000-0000000000c7',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a5"},{"person_id":"00000000-0000-0000-0000-0000000000b6"},{"person_id":"00000000-0000-0000-0000-0000000000c7"}]'::jsonb,
	'Dîner', 'Restaurant', date '2026-08-08');

-- 3) Train 60,00 € — Paul, parts égales entre les 3.
select save_expense('00000000-0000-0000-0000-0000000000e2', 6000, '00000000-0000-0000-0000-0000000000b6',
	'[{"person_id":"00000000-0000-0000-0000-0000000000a5"},{"person_id":"00000000-0000-0000-0000-0000000000b6"},{"person_id":"00000000-0000-0000-0000-0000000000c7"}]'::jsonb,
	'Train', 'Transport', date '2026-08-09');
