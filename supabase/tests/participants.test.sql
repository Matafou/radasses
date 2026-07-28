-- Tests pgTAP : add_participant (nouveau foyer + rattachement à un foyer existant).
begin;
create extension if not exists pgtap;
select plan(4);

\set AL 'cccc0000-0000-0000-0000-0000000000a1'
\set HD 'cccc0000-0000-0000-0000-0000000000f1'
\set TR 'cccc0000-0000-0000-0000-0000000000e1'

insert into households (id, name) values (:'HD', 'Foyer Alice');
insert into persons (id, name) values (:'AL', 'Alice');
insert into trips (id, name) values (:'TR', 'Séjour');
insert into trip_participants (trip_id, person_id, household_id) values (:'TR', :'AL', :'HD');

-- 1) ajout de Bob (nouveau foyer) -> jeton renvoyé
select add_participant(:'TR', 'Bob') as r \gset
select isnt((:'r'::jsonb)->>'token', null, 'add_participant renvoie un token');

-- 2) le séjour compte 2 participants
select is((select count(*) from trip_participants where trip_id = :'TR')::int,
	2, '2 participants');

-- 3) Bob est dans un foyer distinct
select is((select count(distinct household_id) from trip_participants where trip_id = :'TR')::int,
	2, 'Bob a son propre foyer');

-- 4) ajout de Chloé rattachée au foyer d'Alice
select add_participant(:'TR', 'Chloé', null, :'HD');
select is((select count(*) from trip_participants where trip_id = :'TR' and household_id = :'HD')::int,
	2, 'Chloé rattachée au foyer d''Alice');

select * from finish();
rollback;
