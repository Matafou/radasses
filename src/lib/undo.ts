import type { Operation, SaveExpenseInput, BeneficiaryInput } from '$lib/backend';

// « Défaire » une opération = appendre l'OPÉRATION INVERSE (compensation), rejouée via
// les RPC existants (save_expense / delete_expense) → re-journalisée automatiquement.
// v1 : dépenses uniquement (seules journalisées avec un before/after complet), et
// seulement la DERNIÈRE opération de leur entité (règle « pile par entité » : pas
// d'écrasement d'une modification ultérieure). Fonctions PURES (testables).

type ExpenseRow = {
	id: string;
	description: string;
	category: string | null;
	amount_cents: number;
	spent_on: string;
	paid_by_person_id: string;
	version: number;
};
type BeneficiaryRow = {
	person_id: string;
	is_locked: boolean;
	weight: number | null;
	amount_cents: number;
};
type ExpenseSnap = { expense: ExpenseRow; beneficiaries: BeneficiaryRow[] };

export type UndoAction =
	| { kind: 'delete'; expense_id: string; expected_version: number }
	| { kind: 'save'; input: Omit<SaveExpenseInput, 'trip_id'> };

/**
 * Une opération est « défaisable » si c'est une opération de DÉPENSE et la PLUS RÉCENTE
 * de son entité (aucune opération postérieure ne concerne la même dépense) → défaire
 * revient à la dernière action sur cette dépense, sans rien écraser.
 */
export function isUndoable(op: Operation, ops: Operation[]): boolean {
	if (op.entity_type !== 'expense' || op.entity_id == null) return false;
	let latest = -Infinity;
	for (const o of ops) if (o.entity_id === op.entity_id && o.id > latest) latest = o.id;
	return op.id === latest;
}

function toInputs(benefs: BeneficiaryRow[]): BeneficiaryInput[] {
	return benefs.map((b) => ({
		person_id: b.person_id,
		is_locked: b.is_locked,
		weight: b.weight,
		amount_cents: b.amount_cents
	}));
}

// `sameId` : restaure la MÊME dépense (update) avec le verrou de version ; sinon
// (suppression) on RE-CRÉE (nouvel id en v1).
function buildSave(snap: ExpenseSnap, expectedVersion: number | null): Omit<SaveExpenseInput, 'trip_id'> {
	return {
		expense_id: expectedVersion == null ? null : snap.expense.id,
		expected_version: expectedVersion ?? undefined,
		amount_cents: snap.expense.amount_cents,
		paid_by_person_id: snap.expense.paid_by_person_id,
		beneficiaries: toInputs(snap.beneficiaries),
		description: snap.expense.description,
		category: snap.expense.category,
		spent_on: snap.expense.spent_on
	};
}

/** Action inverse d'une opération de dépense (ou `null` si non inversible). */
export function inverseExpenseOp(op: Operation): UndoAction | null {
	if (op.entity_type !== 'expense') return null;
	const after = op.after as ExpenseSnap | null;
	const before = op.before as ExpenseSnap | null;

	// ajout → suppression ; le verrou = la version courante (= after, car c'est la dernière op)
	if (op.action === 'create' && after) {
		return { kind: 'delete', expense_id: after.expense.id, expected_version: after.expense.version };
	}
	// modification → restaurer l'état AVANT (même id, verrou = version courante)
	if (op.action === 'update' && before && after) {
		return { kind: 'save', input: buildSave(before, after.expense.version) };
	}
	// suppression → re-créer depuis l'état AVANT (nouvel id en v1)
	if (op.action === 'delete' && before) {
		return { kind: 'save', input: buildSave(before, null) };
	}
	return null;
}
