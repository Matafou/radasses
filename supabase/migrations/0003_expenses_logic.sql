-- =====================================================================
--  Radasses — Logique métier des dépenses
--   * compute_split : calcul PUR de la répartition (testable isolément)
--   * save_expense  : RPC transactionnelle (dépense + bénéficiaires),
--                     verrou optimiste + journal sémantique
--   * balances      : vue des soldes nets par foyer et par séjour
-- =====================================================================

-- ---------------------------------------------------------------------
--  compute_split(total, bénéficiaires) -> bénéficiaires avec montants résolus
--
--  Entrée : total en centimes + tableau JSON d'objets
--     { person_id, is_locked, weight, amount_cents }
--   - is_locked=true  : montant fixé (amount_cents), invariable
--   - is_locked=false : part proportionnelle (poids `weight`) ; absorbe le reste
--  Règles (invariants) :
--   - au moins un bénéficiaire non verrouillé (le « tampon »)
--   - somme des verrouillés <= total
--   - poids : tout-ou-rien (soit tous les non-verrouillés ont un poids,
--     soit aucun -> parts égales) ; le mélange est rejeté
--  Le reste (total - verrouillés) est réparti au prorata des poids, avec
--  arrondi par la MÉTHODE DES PLUS GRANDS RESTES (somme finale == total).
--  Fonction pure (aucun accès aux tables) -> facile à tester.
-- ---------------------------------------------------------------------

create or replace function public.compute_split(
	p_amount_cents bigint,
	p_beneficiaries jsonb
)
returns jsonb
language plpgsql immutable
as $$
declare
	v_locked_sum       bigint;
	v_unlocked         int;
	v_unlocked_weighted int;
	v_remainder        bigint;
	v_result           jsonb;
begin
	if p_amount_cents < 0 then
		raise exception 'Montant négatif (%).', p_amount_cents;
	end if;
	if jsonb_typeof(p_beneficiaries) is distinct from 'array'
	   or jsonb_array_length(p_beneficiaries) = 0 then
		raise exception 'Aucun bénéficiaire fourni.';
	end if;

	select
		coalesce(sum(amount_cents) filter (where is_locked), 0),
		count(*) filter (where not is_locked),
		count(*) filter (where not is_locked and weight is not null)
	into v_locked_sum, v_unlocked, v_unlocked_weighted
	from (
		select
			coalesce((b->>'is_locked')::boolean, false) as is_locked,
			coalesce((b->>'amount_cents')::bigint, 0)   as amount_cents,
			nullif(b->>'weight', '')::numeric           as weight
		from jsonb_array_elements(p_beneficiaries) b
	) s;

	if v_unlocked < 1 then
		raise exception 'Il doit rester au moins un bénéficiaire non verrouillé (tampon).';
	end if;
	if v_unlocked_weighted > 0 and v_unlocked_weighted < v_unlocked then
		raise exception 'Poids incohérents : mélange de bénéficiaires avec et sans poids (tout ou rien).';
	end if;
	if v_locked_sum > p_amount_cents then
		raise exception 'Somme des montants verrouillés (%) supérieure au total (%).',
			v_locked_sum, p_amount_cents;
	end if;

	v_remainder := p_amount_cents - v_locked_sum;

	select jsonb_agg(
		jsonb_build_object(
			'person_id',    person_id,
			'is_locked',    is_locked,
			'weight',       weight,
			'amount_cents', amount_cents
		) order by ord
	)
	into v_result
	from (
		with b as (
			select
				row_number() over () as ord,
				(e->>'person_id')::uuid                      as person_id,
				coalesce((e->>'is_locked')::boolean, false)  as is_locked,
				nullif(e->>'weight', '')::numeric            as weight,
				coalesce((e->>'amount_cents')::bigint, 0)    as in_amount
			from jsonb_array_elements(p_beneficiaries) e
		),
		-- poids effectifs des non-verrouillés (si tous nuls -> parts égales)
		unlocked as (
			select ord, person_id, weight,
				case when (select coalesce(sum(coalesce(weight, 0)), 0)
				           from b where not is_locked) = 0
				     then 1::numeric
				     else coalesce(weight, 0)
				end as w
			from b where not is_locked
		),
		tot as (select sum(w) as sw from unlocked),
		alloc as (
			select u.ord, u.person_id, u.weight,
				floor(v_remainder * u.w / t.sw)::bigint as base_cents,
				(v_remainder * u.w / t.sw)
					- floor(v_remainder * u.w / t.sw) as frac
			from unlocked u cross join tot t
		),
		leftover as (
			select v_remainder - coalesce(sum(base_cents), 0) as lo from alloc
		),
		ranked as (
			select a.ord, a.person_id, a.weight, a.base_cents,
				row_number() over (order by a.frac desc, a.person_id) as rn
			from alloc a
		),
		computed_unlocked as (
			select r.ord, r.person_id, false as is_locked, r.weight,
				r.base_cents
					+ case when r.rn <= (select lo from leftover) then 1 else 0 end
					as amount_cents
			from ranked r
		),
		locked_rows as (
			select ord, person_id, true as is_locked, weight, in_amount as amount_cents
			from b where is_locked
		)
		select * from computed_unlocked
		union all
		select * from locked_rows
	) r;

	return v_result;
end;
$$;

-- ---------------------------------------------------------------------
--  save_expense : crée (p_expense_id NULL) ou met à jour une dépense,
--  avec sa répartition, en une seule transaction.
--
--  SECURITY DEFINER : les écritures dépenses/bénéficiaires passent
--  EXCLUSIVEMENT par ici (pas de policy d'écriture directe), ce qui
--  garantit systématiquement le calcul du split, le verrou optimiste et
--  la journalisation. Le garde-fou auth.uid() refuse les non-membres ;
--  en accès direct (seed/tests via postgres), auth.uid() est NULL -> OK.
--
--  Verrou optimiste : en mise à jour, p_expected_version doit correspondre
--  à la version courante, sinon erreur de conflit (errcode PT409 -> HTTP 409).
--  NB : ne PAS utiliser 40001 (serialization_failure) que PostgREST réessaie
--  en boucle jusqu'au timeout.
--  Journal : UNE opération avec before/after complets (dépense + split).
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
	if auth.uid() is not null and not is_trip_member(p_trip_id) then
		raise exception 'Accès refusé à ce séjour.' using errcode = '42501';
	end if;

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

grant execute on function public.compute_split(bigint, jsonb) to authenticated;
grant execute on function public.save_expense(uuid, bigint, uuid, jsonb, text, text, date, uuid, int)
	to authenticated;

-- ---------------------------------------------------------------------
--  delete_expense : suppression LOGIQUE (deleted_at) d'une dépense.
--  On conserve la ligne et ses bénéficiaires (historique, dé-suppression
--  future) ; la vue balances les exclut déjà (deleted_at is null).
--  Même garanties que save_expense : membre requis, verrou optimiste,
--  journal sémantique (action 'delete', état complet en `before`).
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
	if auth.uid() is not null and not is_trip_member(p_trip_id) then
		raise exception 'Accès refusé à ce séjour.' using errcode = '42501';
	end if;

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

grant execute on function public.delete_expense(uuid, uuid, int) to authenticated;

-- ---------------------------------------------------------------------
--  Vue balances : solde net par foyer et par séjour.
--   net = payé (dépenses) - dû (parts) + remboursements versés - reçus
--   net > 0  -> le foyer a avancé / on lui doit
--   net < 0  -> le foyer doit
--  security_invoker : les RLS des tables sous-jacentes s'appliquent
--  (un membre ne voit que les soldes de ses séjours).
-- ---------------------------------------------------------------------

create or replace view public.balances
with (security_invoker = true) as
with hh as (
	select distinct trip_id, household_id from trip_participants
),
paid as (
	select e.trip_id, tp.household_id, sum(e.amount_cents) as amt
	from expenses e
	join trip_participants tp
		on tp.trip_id = e.trip_id and tp.person_id = e.paid_by_person_id
	where e.deleted_at is null
	group by e.trip_id, tp.household_id
),
owed as (
	select eb.trip_id, tp.household_id, sum(eb.amount_cents) as amt
	from expense_beneficiaries eb
	join expenses e on e.id = eb.expense_id and e.deleted_at is null
	join trip_participants tp
		on tp.trip_id = eb.trip_id and tp.person_id = eb.person_id
	group by eb.trip_id, tp.household_id
),
paid_settle as (
	select trip_id, from_household_id as household_id, sum(amount_cents) as amt
	from settlements
	where deleted_at is null and trip_id is not null
	group by trip_id, from_household_id
),
recv_settle as (
	select trip_id, to_household_id as household_id, sum(amount_cents) as amt
	from settlements
	where deleted_at is null and trip_id is not null
	group by trip_id, to_household_id
)
select
	hh.trip_id,
	hh.household_id,
	(coalesce(p.amt, 0) - coalesce(o.amt, 0)
		+ coalesce(ps.amt, 0) - coalesce(rs.amt, 0))::bigint as net_cents
from hh
left join paid        p  on p.trip_id  = hh.trip_id and p.household_id  = hh.household_id
left join owed        o  on o.trip_id  = hh.trip_id and o.household_id  = hh.household_id
left join paid_settle ps on ps.trip_id = hh.trip_id and ps.household_id = hh.household_id
left join recv_settle rs on rs.trip_id = hh.trip_id and rs.household_id = hh.household_id;

grant select on public.balances to authenticated;
