-- =====================================================================
--  Radasses — 0007 : durcir la garde d'accès des RPC (dette technique, point 2)
--
--  Avant : chaque RPC (save_expense, delete_expense, add_participant) faisait
--      if auth.uid() is not null and not is_trip_member(p_trip_id) then raise;
--  → si auth.uid() est NULL, la vérification d'appartenance était ENTIÈREMENT
--    sautée. Sûr aujourd'hui (les `grant execute` sont `to authenticated` only,
--    donc `anon` ne peut pas appeler ces fonctions), mais fragile : une future
--    exposition à `anon` aurait ouvert un contournement.
--
--  Après : la garde est factorisée dans `assert_trip_access(trip_id)` :
--    - un appel via l'API DOIT avoir une session (auth.uid() non NULL) ET être
--      membre du séjour ;
--    - le SEUL cas où auth.uid() est NULL et légitime = un accès DIRECT de
--      confiance (seed / tests pgTAP, connectés directement à la base). On le
--      détecte via `session_user` : PostgREST se connecte TOUJOURS sous le rôle
--      `authenticator` (inchangé par SET ROLE / SECURITY DEFINER), donc un appel
--      via l'API avec session_user = 'authenticator' et sans uid est refusé ;
--      un accès direct (session_user = 'postgres'…) est toléré.
--
--  Aucun changement de comportement pour l'app (elle appelle toujours après une
--  session anonyme) ni pour les tests (connexion directe). On ne fait que
--  recréer les 3 fonctions à l'identique, la garde remplacée par un appel au helper.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Helper : garde d'accès commune.
-- ---------------------------------------------------------------------
create or replace function public.assert_trip_access(p_trip_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
	if auth.uid() is null then
		-- Pas de session. Légitime UNIQUEMENT en accès direct de confiance
		-- (seed / tests). Un appel via l'API (PostgREST = rôle `authenticator`)
		-- sans session est refusé (défense en profondeur : `anon` n'a de toute
		-- façon pas le droit d'exécuter ces RPC).
		if session_user = 'authenticator' then
			raise exception 'Non authentifié.' using errcode = '42501';
		end if;
	elsif not is_trip_member(p_trip_id) then
		raise exception 'Accès refusé à ce séjour.' using errcode = '42501';
	end if;
end;
$$;

-- ---------------------------------------------------------------------
--  save_expense — recréée à l'identique de 0003, garde → assert_trip_access.
-- ---------------------------------------------------------------------
create or replace function public.save_expense(
	p_trip_id uuid,
	p_amount_cents bigint,
	p_paid_by_person_id uuid,
	p_beneficiaries jsonb,
	p_description text default '',
	p_category text default null,
	p_spent_on date default null,
	p_expense_id uuid default null,
	p_expected_version int default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
	v_split      jsonb;
	v_expense_id uuid;
	v_version    int;
	v_before     jsonb;
	v_after      jsonb;
	b            jsonb;
begin
	perform assert_trip_access(p_trip_id);

	v_split := compute_split(p_amount_cents, p_beneficiaries);

	if p_expense_id is null then
		insert into expenses (trip_id, description, category, amount_cents,
		                      spent_on, paid_by_person_id, created_by)
		values (p_trip_id, coalesce(p_description, ''), p_category, p_amount_cents,
		        coalesce(p_spent_on, current_date), p_paid_by_person_id, auth.uid())
		returning id, version into v_expense_id, v_version;
		v_before := null;
	else
		-- capture de l'état AVANT + verrou optimiste
		select to_jsonb(e.*) into v_before from expenses e
			where e.id = p_expense_id and e.trip_id = p_trip_id;
		if v_before is null then
			raise exception 'Dépense introuvable dans ce séjour.';
		end if;
		if p_expected_version is not null
		   and (v_before->>'version')::int <> p_expected_version then
			raise exception
				'Conflit : la dépense a été modifiée entre-temps (version attendue %, actuelle %).',
				p_expected_version, (v_before->>'version')::int
				using errcode = 'PT409';
		end if;
		v_before := jsonb_build_object(
			'expense', v_before,
			'beneficiaries', coalesce(
				(select jsonb_agg(to_jsonb(x.*)) from expense_beneficiaries x
				 where x.expense_id = p_expense_id), '[]'::jsonb)
		);

		update expenses set
			description       = coalesce(p_description, ''),
			category          = p_category,
			amount_cents      = p_amount_cents,
			spent_on          = coalesce(p_spent_on, current_date),
			paid_by_person_id = p_paid_by_person_id,
			version           = version + 1,
			updated_at        = now()
		where id = p_expense_id and trip_id = p_trip_id
		returning version into v_version;

		v_expense_id := p_expense_id;
		delete from expense_beneficiaries where expense_id = v_expense_id;
	end if;

	for b in select * from jsonb_array_elements(v_split)
	loop
		insert into expense_beneficiaries
			(expense_id, person_id, is_locked, weight, amount_cents)
		values (
			v_expense_id,
			(b->>'person_id')::uuid,
			(b->>'is_locked')::boolean,
			nullif(b->>'weight', '')::numeric,
			(b->>'amount_cents')::bigint
		);
	end loop;

	-- état APRÈS (dépense + bénéficiaires)
	v_after := jsonb_build_object(
		'expense', (select to_jsonb(e.*) from expenses e where e.id = v_expense_id),
		'beneficiaries', coalesce(
			(select jsonb_agg(to_jsonb(x.*)) from expense_beneficiaries x
			 where x.expense_id = v_expense_id), '[]'::jsonb)
	);

	-- journal sémantique : une seule opération, dépense + split complets
	insert into operations (trip_id, actor_auth_user_id, entity_type, entity_id,
	                        action, before, after)
	values (p_trip_id, auth.uid(), 'expense', v_expense_id,
	        case when p_expense_id is null then 'create' else 'update' end,
	        v_before, v_after);

	return jsonb_build_object(
		'expense_id', v_expense_id,
		'version', v_version,
		'beneficiaries', v_split
	);
end;
$$;

-- ---------------------------------------------------------------------
--  delete_expense — recréée à l'identique de 0003, garde → assert_trip_access.
-- ---------------------------------------------------------------------
create or replace function public.delete_expense(
	p_trip_id uuid,
	p_expense_id uuid,
	p_expected_version int default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
	v_expense jsonb;
	v_before  jsonb;
begin
	perform assert_trip_access(p_trip_id);

	select to_jsonb(e.*) into v_expense from expenses e
		where e.id = p_expense_id and e.trip_id = p_trip_id;
	if v_expense is null then
		raise exception 'Dépense introuvable dans ce séjour.';
	end if;
	if (v_expense->>'deleted_at') is not null then
		raise exception 'Dépense déjà supprimée.';
	end if;
	if p_expected_version is not null
	   and (v_expense->>'version')::int <> p_expected_version then
		raise exception
			'Conflit : la dépense a été modifiée entre-temps (version attendue %, actuelle %).',
			p_expected_version, (v_expense->>'version')::int
			using errcode = 'PT409';
	end if;

	v_before := jsonb_build_object(
		'expense', v_expense,
		'beneficiaries', coalesce(
			(select jsonb_agg(to_jsonb(x.*)) from expense_beneficiaries x
			 where x.expense_id = p_expense_id), '[]'::jsonb)
	);

	update expenses set
		deleted_at = now(),
		version    = version + 1,
		updated_at = now()
	where id = p_expense_id and trip_id = p_trip_id;

	insert into operations (trip_id, actor_auth_user_id, entity_type, entity_id,
	                        action, before, after)
	values (p_trip_id, auth.uid(), 'expense', p_expense_id, 'delete', v_before, null);

	return jsonb_build_object('expense_id', p_expense_id, 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------
--  add_participant — recréée à l'identique de 0004, garde → assert_trip_access.
-- ---------------------------------------------------------------------
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
