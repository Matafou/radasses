-- Tests pgTAP : contrôle d'accès RLS, avec un utilisateur AUTHENTIFIÉ simulé.
-- On bascule `role authenticated` + on injecte `request.jwt.claims` (sub = l'id
-- de l'utilisateur d'auth) pour que auth.uid() renvoie l'utilisateur voulu.
-- Vérifie : un membre voit son séjour, un non-membre ne voit rien,
-- et save_expense refuse un non-membre.

begin;
create extension if not exists pgtap;
select plan(7);

-- Deux utilisateurs d'auth (uuids hex valides)
\set MEMBER   '11111111-1111-1111-1111-111111111111'
\set OUTSIDER '22222222-2222-2222-2222-222222222222'
-- Données du séjour
\set AL 'bbbb0000-0000-0000-0000-0000000000a1'
\set HD 'bbbb0000-0000-0000-0000-0000000000f1'
\set TR 'bbbb0000-0000-0000-0000-0000000000e1'

-- Setup en tant que postgres (superuser)
insert into auth.users (id, aud, role, email) values
	(:'MEMBER',   'authenticated', 'authenticated', 'member@test.local'),
	(:'OUTSIDER', 'authenticated', 'authenticated', 'outsider@test.local');

insert into households (id, name) values (:'HD', 'Foyer test');
insert into persons (id, name) values (:'AL', 'Alice');
insert into trips (id, name) values (:'TR', 'Séjour test');
insert into trip_participants (trip_id, person_id, household_id)
	values (:'TR', :'AL', :'HD');
insert into participant_access (trip_participant_id, auth_user_id)
	select id, :'MEMBER' from trip_participants where trip_id = :'TR' and person_id = :'AL';

-- ============ En tant que MEMBRE ============
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'MEMBER'), true);
set local role authenticated;

-- 1) is_trip_member vrai pour le membre
select is(is_trip_member(:'TR'), true, 'membre : is_trip_member = true');

-- 2) le membre voit le séjour (RLS)
select is((select count(*) from trips where id = :'TR')::int, 1, 'membre : voit le séjour');

-- 3) le membre voit le solde de son foyer
select is((select count(*) from balances where trip_id = :'TR')::int, 1, 'membre : voit balances');

-- 4) le membre peut créer une dépense via save_expense
select isnt(
	save_expense(:'TR', 1000, :'AL', format('[{"person_id":"%s"}]', :'AL')::jsonb) ->> 'expense_id',
	null, 'membre : save_expense crée une dépense'
);

-- ============ En tant que NON-MEMBRE ============
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'OUTSIDER'), true);

-- 5) is_trip_member faux
select is(is_trip_member(:'TR'), false, 'non-membre : is_trip_member = false');

-- 6) le non-membre ne voit pas le séjour (RLS)
select is((select count(*) from trips where id = :'TR')::int, 0, 'non-membre : ne voit rien');

-- 7) save_expense refuse le non-membre (errcode 42501)
select throws_ok(
	format($$ select save_expense('%s', 1000, '%s', '[{"person_id":"%s"}]'::jsonb) $$, :'TR', :'AL', :'AL'),
	'42501'
);

reset role;
select * from finish();
rollback;
