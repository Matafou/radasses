-- =====================================================================
--  Radasses — 0006 : suppression de la table `settlements`
--
--  Un remboursement est désormais modélisé comme une simple dépense (payeur =
--  débiteur, unique bénéficiaire = créancier qui « reçoit » tout le montant).
--  La table `settlements` et son mécanisme parallèle deviennent inutiles.
--
--  On recompose d'abord la vue `balances` SANS référence aux règlements
--  (sinon `drop table ... cascade` supprimerait aussi la vue), puis on
--  supprime la table (avec ses policies, son trigger de journal, son index).
--  Le journal (`operations`) conserve ses anciennes entrées 'settlement' :
--  ce sont des lignes de log historiques, sans FK vers la table supprimée.
-- =====================================================================

-- 1) Vue balances = payé - dû (fin de la composante settlements).
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
)
select
	hh.trip_id,
	hh.household_id,
	(coalesce(p.amt, 0) - coalesce(o.amt, 0))::bigint as net_cents
from hh
left join paid p on p.trip_id = hh.trip_id and p.household_id = hh.household_id
left join owed o on o.trip_id = hh.trip_id and o.household_id = hh.household_id;

-- 2) La table n'est plus référencée par la vue -> suppression (policies,
--    trigger de journal, index et grants partent avec via cascade).
drop table if exists public.settlements cascade;
