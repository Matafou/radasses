-- Tests pgTAP : lien de séjour partageable (« Qui es-tu ? »).
-- list_join_candidates (liste + drapeau claimed, jeton invalide) et
-- claim_participant (rattachement ciblé par choix, garde d'appartenance au séjour).
begin;
create extension if not exists pgtap;
select plan(7);

\set USER 'dddd0000-0000-0000-0000-0000000000c3'
\set AL   'dddd0000-0000-0000-0000-0000000000a1'
\set BO   'dddd0000-0000-0000-0000-0000000000b2'
\set HA   'dddd0000-0000-0000-0000-0000000000f1'
\set HB   'dddd0000-0000-0000-0000-0000000000f2'
\set TR   'dddd0000-0000-0000-0000-0000000000e1'
\set JT   'jointokentest00000000000000000000'

insert into auth.users (id, aud, role, email) values
	(:'USER', 'authenticated', 'authenticated', 'joiner@test.local');

insert into households (id, name) values (:'HA', 'Alice'), (:'HB', 'Bob');
insert into persons (id, name) values (:'AL', 'Alice'), (:'BO', 'Bob');
insert into trips (id, name, join_token) values (:'TR', 'Séjour', :'JT');
insert into trip_participants (trip_id, person_id, household_id) values
	(:'TR', :'AL', :'HA'), (:'TR', :'BO', :'HB');

-- Alice a déjà réclamé son identité (au moins un accès) ; Bob non.
insert into participant_access (trip_participant_id, auth_user_id)
	select id, :'USER' from trip_participants where trip_id = :'TR' and person_id = :'AL';

-- id des participations (pour cibler le claim par trip_participant_id)
select id as al_tp from trip_participants where trip_id = :'TR' and person_id = :'AL' \gset
select id as bo_tp from trip_participants where trip_id = :'TR' and person_id = :'BO' \gset

-- ============ list_join_candidates (pas de session requise) ============
-- 1) deux candidats listés pour ce jeton
select is((select count(*) from list_join_candidates(:'JT'))::int, 2, 'liste : 2 candidats');

-- 2-3) drapeau claimed correct
select is((select claimed from list_join_candidates(:'JT') where person_name = 'Alice'),
	true, 'Alice : déjà réclamée');
select is((select claimed from list_join_candidates(:'JT') where person_name = 'Bob'),
	false, 'Bob : non réclamé');

-- 4) jeton invalide -> exception
select throws_ok(
	$$ select * from list_join_candidates('mauvais-jeton') $$,
	'P0001'
);

-- ============ claim_participant (session authentifiée simulée) ============
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'USER'), true);
set local role authenticated;

-- 5) réclamer Bob -> renvoie l'id du séjour
select is(claim_participant(:'JT', :'bo_tp'::uuid), :'TR'::uuid, 'claim_participant renvoie le séjour');

reset role;

-- 6) l'accès de Bob est créé pour cet utilisateur
select is(
	(select count(*) from participant_access where trip_participant_id = :'bo_tp' and auth_user_id = :'USER')::int,
	1, 'claim_participant : accès créé pour Bob'
);

-- 7) un participant hors de ce séjour est refusé (garde d'appartenance)
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'USER'), true);
set local role authenticated;
select throws_ok(
	format($$ select claim_participant('%s', '%s') $$, :'JT', '00000000-0000-0000-0000-000000000000'),
	'P0001'
);
reset role;

select * from finish();
rollback;
