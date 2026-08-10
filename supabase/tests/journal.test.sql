-- Tests pgTAP : « journaliser tout » (migration 0009). Vérifie que les triggers
-- journalisent trips / persons / households (create + update), et que le nom est
-- bien capturé dans `after` (utile pour un futur fold event-sourcing). Transaction
-- annulée à la fin → rien de persisté.

begin;
create extension if not exists pgtap;
select plan(7);

\set TR 'cccc0000-0000-0000-0000-0000000000e1'
\set HH 'cccc0000-0000-0000-0000-0000000000f1'
\set PE 'cccc0000-0000-0000-0000-0000000000a1'

-- create trip
insert into trips (id, name) values (:'TR', 'Journal test');
select is(
	(select count(*)::int from operations
		where trip_id = :'TR' and entity_type = 'trip' and action = 'create'),
	1, 'insert trip -> opération trip/create');

-- create household (trip_id porté par la ligne)
insert into households (id, name, trip_id) values (:'HH', 'Foyer', :'TR');
select is(
	(select count(*)::int from operations
		where trip_id = :'TR' and entity_type = 'household' and action = 'create'),
	1, 'insert household -> opération household/create');

-- create person
insert into persons (id, name, trip_id) values (:'PE', 'Alice', :'TR');
select is(
	(select count(*)::int from operations
		where trip_id = :'TR' and entity_type = 'person' and action = 'create'),
	1, 'insert person -> opération person/create');

-- le nom est capturé dans le snapshot `after` (nécessaire au fold)
select is(
	(select after ->> 'name' from operations
		where trip_id = :'TR' and entity_type = 'person' and action = 'create' limit 1),
	'Alice', 'opération person/create porte le nom');

-- update household name
update households set name = 'Foyer bis' where id = :'HH';
select is(
	(select count(*)::int from operations
		where trip_id = :'TR' and entity_type = 'household' and action = 'update'),
	1, 'update household -> opération household/update');

-- update person name
update persons set name = 'Alicia' where id = :'PE';
select is(
	(select count(*)::int from operations
		where trip_id = :'TR' and entity_type = 'person' and action = 'update'),
	1, 'update person -> opération person/update');

-- update trip (nom / réglages)
update trips set name = 'Journal test 2' where id = :'TR';
select is(
	(select count(*)::int from operations
		where trip_id = :'TR' and entity_type = 'trip' and action = 'update'),
	1, 'update trip -> opération trip/update');

select * from finish();
rollback;
