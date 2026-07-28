-- =====================================================================
--  Radasses — add_participant
--  Ajoute un participant à un séjour de façon atomique : crée la personne,
--  son foyer (nouveau, ou rattachement à un foyer déjà présent), la
--  participation, et renvoie le jeton d'invitation (lien à partager).
--  Le participant n'a pas encore de session liée : il rejoindra via son lien.
-- =====================================================================

create or replace function public.add_participant(
	p_trip_id uuid,
	p_person_name text,
	p_household_name text default null,   -- ignoré si p_household_id fourni
	p_household_id uuid default null,     -- rattacher à un foyer existant du séjour
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
	if auth.uid() is not null and not is_trip_member(p_trip_id) then
		raise exception 'Accès refusé à ce séjour.' using errcode = '42501';
	end if;
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
		insert into households (name)
		values (coalesce(nullif(trim(p_household_name), ''), p_person_name))
		returning id into v_household;
	end if;

	insert into persons (name) values (p_person_name) returning id into v_person;

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

grant execute on function public.add_participant(uuid, text, text, uuid, numeric) to authenticated;
