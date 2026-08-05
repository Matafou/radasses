import type { Expense, Beneficiary } from '$lib/backend';

/** Une ligne de relevé : ce que le « sujet » a payé et/ou doit sur une dépense. */
export type LedgerLine = {
	expense_id: string;
	description: string;
	spent_on: string;
	/** montant payé par le sujet sur cette dépense (0 s'il n'est pas le payeur) */
	paid_cents: number;
	/** part due par le sujet sur cette dépense (0 s'il n'en est pas bénéficiaire) */
	owed_cents: number;
};

/** Décomposition crédit/débit d'un sujet (une personne, ou un foyer = ses membres). */
export type BalanceDetail = {
	paid_cents: number; // crédit total
	owed_cents: number; // débit total
	net_cents: number; // crédit − débit
	lines: LedgerLine[]; // dépenses concernées, dans l'ordre des `expenses` fournis
};

/**
 * Décompose le solde d'un « sujet » (ensemble de `person_id` : une personne seule,
 * ou tous les membres d'un foyer) à partir des dépenses et des bénéficiaires déjà
 * chargés. Les parts individuelles sont stockées telles quelles
 * (`expense_beneficiaries.amount_cents`) → simple agrégation, pas de recalcul de
 * split. Fonction PURE (testable). Pour un foyer, `net_cents` égale la vue `balances`.
 */
export function computeBalanceDetail(
	personIds: Iterable<string>,
	expenses: Expense[],
	beneficiaries: Beneficiary[]
): BalanceDetail {
	const ids = new Set(personIds);
	const owedByExpense = new Map<string, number>();
	for (const b of beneficiaries) {
		if (ids.has(b.person_id)) {
			owedByExpense.set(b.expense_id, (owedByExpense.get(b.expense_id) ?? 0) + b.amount_cents);
		}
	}
	const lines: LedgerLine[] = [];
	let paid = 0;
	let owed = 0;
	for (const e of expenses) {
		const paid_cents = ids.has(e.paid_by_person_id) ? e.amount_cents : 0;
		const owed_cents = owedByExpense.get(e.id) ?? 0;
		if (paid_cents === 0 && owed_cents === 0) continue;
		paid += paid_cents;
		owed += owed_cents;
		lines.push({
			expense_id: e.id,
			description: e.description,
			spent_on: e.spent_on,
			paid_cents,
			owed_cents
		});
	}
	return { paid_cents: paid, owed_cents: owed, net_cents: paid - owed, lines };
}
