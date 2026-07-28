import { supabase } from './supabase';
import { ensureSession } from './auth';
import type { Balance } from './db';

export type Transfer = {
	from_household_id: string;
	to_household_id: string;
	amount_cents: number;
};

/**
 * « Qui doit à qui » : à partir des soldes nets par foyer (somme = 0),
 * produit une liste de virements foyer→foyer qui minimise le NOMBRE de
 * transferts (algorithme glouton : on éponge le plus gros débiteur avec le
 * plus gros créancier, et on recommence). Fonction PURE (testable).
 */
export function simplifyDebts(balances: Balance[]): Transfer[] {
	const debtors = balances
		.filter((b) => b.net_cents < 0)
		.map((b) => ({ id: b.household_id, amt: -b.net_cents }))
		.sort((a, b) => b.amt - a.amt);
	const creditors = balances
		.filter((b) => b.net_cents > 0)
		.map((b) => ({ id: b.household_id, amt: b.net_cents }))
		.sort((a, b) => b.amt - a.amt);

	const transfers: Transfer[] = [];
	let i = 0;
	let j = 0;
	while (i < debtors.length && j < creditors.length) {
		const pay = Math.min(debtors[i].amt, creditors[j].amt);
		if (pay > 0) {
			transfers.push({
				from_household_id: debtors[i].id,
				to_household_id: creditors[j].id,
				amount_cents: pay
			});
		}
		debtors[i].amt -= pay;
		creditors[j].amt -= pay;
		if (debtors[i].amt === 0) i++;
		if (creditors[j].amt === 0) j++;
	}
	return transfers;
}

/** Enregistre un remboursement effectif d'un foyer vers un autre. */
export async function recordSettlement(params: {
	trip_id: string;
	from_household_id: string;
	to_household_id: string;
	amount_cents: number;
}): Promise<void> {
	await ensureSession();
	const { error } = await supabase.from('settlements').insert({
		trip_id: params.trip_id,
		from_household_id: params.from_household_id,
		to_household_id: params.to_household_id,
		amount_cents: params.amount_cents
	});
	if (error) throw error;
}

/** Annule (suppression logique) un remboursement enregistré. */
export async function cancelSettlement(id: string): Promise<void> {
	await ensureSession();
	const { error } = await supabase
		.from('settlements')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id);
	if (error) throw error;
}
