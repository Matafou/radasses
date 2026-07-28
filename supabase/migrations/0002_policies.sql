-- =====================================================================
--  Radasses — Sécurité (RLS), fonctions d'accès, journalisation
--
--  Modèle : identification par URL + sessions anonymes Supabase.
--  Un utilisateur (auth.uid(), possiblement anonyme) a accès à un séjour
--  s'il possède une ligne `participant_access` vers un participant de ce
--  séjour. Le rattachement se fait via `redeem_token(<jeton de l'URL>)`.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Fonctions d'appartenance (SECURITY DEFINER pour éviter la récursion RLS)
-- ---------------------------------------------------------------------

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
	select exists (
		select 1
		from trip_participants tp
		join participant_access pa on pa.trip_participant_id = tp.id
		where tp.trip_id = p_trip_id
		  and pa.auth_user_id = auth.uid()
	);
$$;

create or replace function public.can_see_person(p_person_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
	select exists (
		select 1
		from trip_participants tp
		join participant_access pa on pa.trip_participant_id = tp.id
		where tp.person_id = p_person_id
		  and pa.auth_user_id = auth.uid()
	);
$$;

create or replace function public.can_see_household(p_household_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
	select exists (
		select 1
		from trip_participants tp
		join participant_access pa on pa.trip_participant_id = tp.id
		where tp.household_id = p_household_id
		  and pa.auth_user_id = auth.uid()
	);
$$;

-- ---------------------------------------------------------------------
--  RPC : rejoindre un séjour via un jeton d'URL
-- ---------------------------------------------------------------------

create or replace function public.redeem_token(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
	v_tp trip_participants;
begin
	if auth.uid() is null then
		raise exception 'Session requise';
	end if;
	select * into v_tp from trip_participants where invite_token = p_token;
	if not found then
		raise exception 'Jeton invalide';
	end if;
	insert into participant_access (trip_participant_id, auth_user_id)
	values (v_tp.id, auth.uid())
	on conflict do nothing;
	return v_tp.trip_id;
end;
$$;

-- ---------------------------------------------------------------------
--  RPC : créer un séjour + son premier participant (moi)
--  Résout le bootstrap (aucun participant n'existe encore -> pas d'accès RLS).
-- ---------------------------------------------------------------------

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

	insert into households (name)
	values (coalesce(nullif(p_my_household_name, ''), p_my_name))
	returning id into v_household;

	insert into persons (name) values (p_my_name) returning id into v_person;

	insert into trip_participants (trip_id, person_id, household_id, default_percent)
	values (v_trip, v_person, v_household, 0)
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

grant execute on function public.redeem_token(text) to authenticated;
grant execute on function public.create_trip(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
--  Journalisation automatique (triggers) — remplit `operations`
-- ---------------------------------------------------------------------

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
		v_trip := new.trip_id; v_entity := new.id;
	elsif tg_op = 'UPDATE' then
		v_before := to_jsonb(old); v_after := to_jsonb(new);
		v_trip := new.trip_id; v_entity := new.id;
		-- suppression logique (deleted_at passe de NULL à non-NULL) -> 'delete'
		if (to_jsonb(old) ->> 'deleted_at') is null
		   and (to_jsonb(new) ->> 'deleted_at') is not null then
			v_action := 'delete';
		else
			v_action := 'update';
		end if;
	else -- DELETE physique
		v_action := 'delete'; v_before := to_jsonb(old); v_after := null;
		v_trip := old.trip_id; v_entity := old.id;
	end if;

	insert into operations (trip_id, actor_auth_user_id, entity_type, entity_id, action, before, after)
	values (v_trip, auth.uid(), tg_argv[0], v_entity, v_action, v_before, v_after);
	return null;
end;
$$;

-- NB : pas de trigger de journal sur `expenses` : la journalisation des
-- dépenses est faite sémantiquement par save_expense (dépense + bénéficiaires
-- dans une seule opération). Voir 0003.

create trigger trg_log_settlements
	after insert or update or delete on settlements
	for each row execute function log_operation('settlement');

create trigger trg_log_participants
	after insert or update or delete on trip_participants
	for each row execute function log_operation('participant');

-- ---------------------------------------------------------------------
--  Trigger d'intégrité : remplit expense_beneficiaries.trip_id
--  automatiquement depuis la dépense parente (empêche toute incohérence).
-- ---------------------------------------------------------------------

create or replace function public.fill_beneficiary_trip()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
	select trip_id into new.trip_id from expenses where id = new.expense_id;
	return new;
end;
$$;

create trigger trg_fill_beneficiary_trip
	before insert or update on expense_beneficiaries
	for each row execute function fill_beneficiary_trip();

-- =====================================================================
--  Row Level Security
-- =====================================================================

alter table households           enable row level security;
alter table persons              enable row level security;
alter table trips                enable row level security;
alter table trip_participants    enable row level security;
alter table participant_access   enable row level security;
alter table expenses             enable row level security;
alter table expense_beneficiaries enable row level security;
alter table settlements          enable row level security;
alter table operations           enable row level security;

-- ---------------------------------------------------------------------
--  Privilèges de rôle — NÉCESSAIRES EN PLUS des RLS.
--  (La RLS filtre les lignes ; encore faut-il que le rôle ait le droit de
--   base sur la table. Non fournis automatiquement en local.)
--  Les sessions (anonymes ou non) ont le rôle `authenticated`.
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;

-- Lecture : toutes les tables (bornée par les policies SELECT).
grant select on all tables in schema public to authenticated;

-- Écritures directes autorisées aux membres (bornées par les policies) :
grant insert, update, delete on trip_participants to authenticated;
grant insert, update          on households        to authenticated;
grant insert, update          on persons           to authenticated;
grant update                  on trips             to authenticated;
grant insert, update          on settlements       to authenticated;
-- expenses / expense_beneficiaries / participant_access / operations :
-- lecture seule pour `authenticated` ; toute écriture passe par les RPC
-- (create_trip, redeem_token, save_expense) en SECURITY DEFINER.

-- --- trips : lecture/écriture réservées aux membres. Création via RPC. ---
create policy trips_select on trips for select to authenticated
	using (is_trip_member(id));
create policy trips_update on trips for update to authenticated
	using (is_trip_member(id)) with check (is_trip_member(id));

-- --- trip_participants : les membres voient et ajoutent des participants ---
create policy tp_select on trip_participants for select to authenticated
	using (is_trip_member(trip_id));
create policy tp_insert on trip_participants for insert to authenticated
	with check (is_trip_member(trip_id));
create policy tp_update on trip_participants for update to authenticated
	using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy tp_delete on trip_participants for delete to authenticated
	using (is_trip_member(trip_id));

-- --- participant_access : je vois mes rattachements + ceux de mes séjours ---
create policy pa_select on participant_access for select to authenticated
	using (
		auth_user_id = auth.uid()
		or is_trip_member((select trip_id from trip_participants where id = trip_participant_id))
	);
-- insertion uniquement via redeem_token / create_trip (SECURITY DEFINER)

-- --- households / persons : visibles si on partage un séjour ---
create policy hh_select on households for select to authenticated
	using (can_see_household(id));
create policy hh_insert on households for insert to authenticated
	with check (auth.uid() is not null);
create policy hh_update on households for update to authenticated
	using (can_see_household(id)) with check (can_see_household(id));

create policy pers_select on persons for select to authenticated
	using (can_see_person(id));
create policy pers_insert on persons for insert to authenticated
	with check (auth.uid() is not null);
create policy pers_update on persons for update to authenticated
	using (can_see_person(id)) with check (can_see_person(id));

-- --- expenses / expense_beneficiaries ---
-- Lecture par les membres. AUCUNE écriture directe : toute création/modification
-- passe par la RPC save_expense (SECURITY DEFINER) qui garantit le calcul du
-- split, le verrou optimiste et la journalisation sémantique.
create policy exp_select on expenses for select to authenticated
	using (is_trip_member(trip_id));

create policy eb_select on expense_beneficiaries for select to authenticated
	using (is_trip_member(trip_id));

-- --- settlements ---
create policy set_select on settlements for select to authenticated
	using (is_trip_member(trip_id));
create policy set_insert on settlements for insert to authenticated
	with check (is_trip_member(trip_id));
create policy set_update on settlements for update to authenticated
	using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));

-- --- operations : lecture par les membres, AUCUNE écriture directe ---
-- (le journal n'est alimenté que par les triggers, en SECURITY DEFINER,
--  et aucune policy insert/update/delete n'existe -> append only garanti)
create policy ops_select on operations for select to authenticated
	using (is_trip_member(trip_id));
