-- Lien de séjour PARTAGEABLE (un seul, pour tous) + auto-désignation.
-- Complément du jeton par participant (`invite_token`, redeem_token) : au lieu
-- d'envoyer N liens individuels, on diffuse UN lien de séjour et chacun choisit
-- son nom dans la liste (« Qui es-tu ? »).
--
-- Garde de ces RPC = le SECRET `join_token` (et surtout PAS assert_trip_access :
-- l'appelant n'est justement pas encore membre, comme pour redeem_token gardé par
-- l'invite_token). SECURITY DEFINER pour contourner la RLS (un non-membre ne voit
-- ni le séjour ni ses participants).

alter table trips
	add column join_token text not null unique
		default replace(gen_random_uuid()::text, '-', '');

-- Liste les participants d'un séjour pour l'écran « Qui es-tu ? », sur présentation
-- du jeton de séjour. `claimed` = cette identité a déjà été réclamée au moins une
-- fois (→ variante de confirmation côté UI).
create or replace function public.list_join_candidates(p_join_token text)
returns table (participant_id uuid, person_name text, household_name text, claimed boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
	v_trip uuid;
begin
	select id into v_trip from trips where join_token = p_join_token;
	if v_trip is null then
		raise exception 'Jeton invalide';
	end if;
	return query
		select tp.id, p.name, h.name,
			exists (select 1 from participant_access pa where pa.trip_participant_id = tp.id)
		from trip_participants tp
		join persons p on p.id = tp.person_id
		join households h on h.id = tp.household_id
		where tp.trip_id = v_trip
		order by tp.created_at;
end;
$$;

-- Réclame une identité (participant) via le jeton de séjour : lie la session
-- courante au participant CHOISI. = redeem_token, mais ciblé par choix et gardé par
-- le join_token. Idempotent (rejouable : multi-appareil, re-réclamation).
create or replace function public.claim_participant(p_join_token text, p_participant_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
	v_trip uuid;
begin
	if auth.uid() is null then
		raise exception 'Session requise';
	end if;
	select id into v_trip from trips where join_token = p_join_token;
	if v_trip is null then
		raise exception 'Jeton invalide';
	end if;
	-- le participant choisi doit bien appartenir au séjour de CE jeton
	if not exists (
		select 1 from trip_participants where id = p_participant_id and trip_id = v_trip
	) then
		raise exception 'Participant invalide';
	end if;
	insert into participant_access (trip_participant_id, auth_user_id)
	values (p_participant_id, auth.uid())
	on conflict do nothing;
	return v_trip;
end;
$$;

grant execute on function public.list_join_candidates(text) to authenticated;
grant execute on function public.claim_participant(text, uuid) to authenticated;
