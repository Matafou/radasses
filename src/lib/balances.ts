import type { Participant, Expense, Beneficiary, Balance } from '$lib/backend';
import { computeBalanceDetail } from '$lib/balance-detail';

/**
 * Soldes nets par foyer, calculés LOCALEMENT — réplique fidèle de la vue SQL
 * `balances` (cf. 0006 : `payé − dû` par foyer). Pivot de l'offlinisation : les
 * soldes se recalculent depuis les données déjà chargées, sans requête réseau, et
 * restent cohérents après une mutation locale.
 *
 * Fidélité à la vue :
 * - un foyer par `household_id` DISTINCT des participants (`hh` = distinct
 *   household_id), même sans dépense (net 0) ;
 * - TOUS les participants comptent, actifs comme inactifs (la vue ne filtre pas
 *   sur `active`) ;
 * - seules les dépenses non supprimées entrent (garanti par la liste `expenses`
 *   fournie, qui exclut déjà les `deleted_at`).
 *
 * Fonction PURE (testable). Réutilise `computeBalanceDetail` (net foyer == vue).
 */
export function computeBalances(
	participants: Participant[],
	expenses: Expense[],
	beneficiaries: Beneficiary[]
): Balance[] {
	// person_id groupés par foyer (ordre = première apparition du foyer).
	const membersByHousehold = new Map<string, string[]>();
	for (const p of participants) {
		const arr = membersByHousehold.get(p.household_id);
		if (arr) arr.push(p.person_id);
		else membersByHousehold.set(p.household_id, [p.person_id]);
	}
	const out: Balance[] = [];
	for (const [household_id, personIds] of membersByHousehold) {
		const { net_cents } = computeBalanceDetail(personIds, expenses, beneficiaries);
		out.push({ household_id, net_cents });
	}
	return out;
}
