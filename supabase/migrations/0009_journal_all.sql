-- ---------------------------------------------------------------------
--  « Journaliser tout » : rendre le journal `operations` COMPLET (prérequis de
--  la bascule event-sourcing). Aujourd'hui seuls `trip_participants` (trigger) et
--  les dépenses (save_expense/delete_expense) sont journalisés ; les NOMS
--  (`persons`, `households`) et les RÉGLAGES (`trips`) ne le sont pas.
--
--  Choix (Approche A) : rattacher `persons`/`households` à un séjour via un
--  `trip_id` porté par la ligne → `log_operation` peut journaliser par trigger de
--  façon UNIFORME (création comprise), robuste à tout chemin d'écriture. Cela fait
--  aussi avancer « foyers comme entités à part entière ».
-- ---------------------------------------------------------------------

-- 1) Colonnes trip_id (nullable), backfill via l'appartenance, nettoyage des
--    orphelins (foyers/personnes sans membre), puis NOT NULL.
alter table households add column trip_id uuid references trips(id) on delete cascade;
alter table persons    add column trip_id uuid references trips(id) on delete cascade;

update households h
	set trip_id = tp.trip_id
	from (select distinct household_id, trip_id from trip_participants) tp
	where tp.household_id = h.id;
update persons p
	set trip_id = tp.trip_id
	from (select distinct person_id, trip_id from trip_participants) tp
	where tp.person_id = p.id;

-- Orphelins (jamais rattachés à un séjour : foyers vides laissés par un
-- déplacement, personnes sans participation) → invisibles/inutilisés, on les retire
-- pour pouvoir imposer NOT NULL.
delete from households where trip_id is null;
delete from persons    where trip_id is null;

alter table households alter column trip_id set not null;
alter table persons    alter column trip_id set not null;

create index on households (trip_id);
create index on persons (trip_id);

-- 2) `log_operation` rendu « trip-aware » : pour l'entité `trip`, l'id de la ligne
--    EST le séjour ; sinon on lit `trip_id`. (Le reste inchangé : snapshots
--    before/after, suppression logique via `deleted_at`.)
create or replace function public.log_operation()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
	v_trip   uuid;
	v_entity uuid;
	v_action text;
	v_before jsonb;
	v_after  jsonb;
begin
	if tg_op = 'INSERT' then
		v_action := 'create'; v_before := null; v_after := to_jsonb(new);
		v_entity := new.id;
		if tg_argv[0] = 'trip' then v_trip := new.id; else v_trip := new.trip_id; end if;
	elsif tg_op = 'UPDATE' then
		v_before := to_jsonb(old); v_after := to_jsonb(new);
		v_entity := new.id;
		if tg_argv[0] = 'trip' then v_trip := new.id; else v_trip := new.trip_id; end if;
		-- suppression logique (deleted_at passe de NULL à non-NULL) -> 'delete'
		if (to_jsonb(old) ->> 'deleted_at') is null
		   and (to_jsonb(new) ->> 'deleted_at') is not null then
			v_action := 'delete';
		else
			v_action := 'update';
		end if;
	else -- DELETE physique
		v_action := 'delete'; v_before := to_jsonb(old); v_after := null;
		v_entity := old.id;
		if tg_argv[0] = 'trip' then v_trip := old.id; else v_trip := old.trip_id; end if;
	end if;

	insert into operations (trip_id, actor_auth_user_id, entity_type, entity_id, action, before, after)
	values (v_trip, auth.uid(), tg_argv[0], v_entity, v_action, v_before, v_after);
	return null;
end;
$$;

-- 3) Triggers de journal sur trips / persons / households (insert/update/delete).
create trigger trg_log_trips
	after insert or update or delete on trips
	for each row execute function log_operation('trip');

create trigger trg_log_persons
	after insert or update or delete on persons
	for each row execute function log_operation('person');

create trigger trg_log_households
	after insert or update or delete on households
	for each row execute function log_operation('household');

-- 4) Renseigner `trip_id` sur les créations de foyers/personnes dans les RPC.
--    (setParticipantHousehold — insert direct côté client — reçoit désormais trip_id.)
create or replace function public.create_trip(
	p_name text,
	p_currency text,
	p_my_name text,
	p_my_household_name text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
	v_trip      uuid;
	v_person    uuid;
	v_household uuid;
	v_tp        trip_participants;
begin
	if auth.uid() is null then
		raise exception 'Session requise';
	end if;

	insert into trips (name, currency)
	values (p_name, coalesce(nullif(p_currency, ''), 'EUR'))
	returning id into v_trip;

	insert into households (name, trip_id)
	values (coalesce(nullif(p_my_household_name, ''), p_my_name), v_trip)
	returning id into v_household;

	insert into persons (name, trip_id) values (p_my_name, v_trip) returning id into v_person;

	insert into trip_participants (trip_id, person_id, household_id, default_weight)
	values (v_trip, v_person, v_household, 1)
	returning * into v_tp;

	insert into participant_access (trip_participant_id, auth_user_id)
	values (v_tp.id, auth.uid());

	return jsonb_build_object(
		'trip_id', v_trip,
		'participant_id', v_tp.id,
		'token', v_tp.invite_token
	);
end;
$$;

create or replace function public.add_participant(
	p_trip_id uuid,
	p_person_name text,
	p_household_name text default null,
	p_household_id uuid default null,
	p_default_weight numeric default 1
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
	v_household uuid;
	v_person    uuid;
	v_tp        trip_participants;
begin
	perform assert_trip_access(p_trip_id);
	if coalesce(trim(p_person_name), '') = '' then
		raise exception 'Nom de la personne requis.';
	end if;

	if p_household_id is not null then
		if not exists (
			select 1 from trip_participants
			where trip_id = p_trip_id and household_id = p_household_id
		) then
			raise exception 'Foyer inconnu pour ce séjour.';
		end if;
		v_household := p_household_id;
	else
		insert into households (name, trip_id)
		values (coalesce(nullif(trim(p_household_name), ''), p_person_name), p_trip_id)
		returning id into v_household;
	end if;

	insert into persons (name, trip_id) values (p_person_name, p_trip_id) returning id into v_person;

	insert into trip_participants (trip_id, person_id, household_id, default_weight)
	values (p_trip_id, v_person, v_household, coalesce(p_default_weight, 1))
	returning * into v_tp;

	return jsonb_build_object(
		'participant_id', v_tp.id,
		'person_id',      v_person,
		'household_id',   v_household,
		'token',          v_tp.invite_token
	);
end;
$$;
