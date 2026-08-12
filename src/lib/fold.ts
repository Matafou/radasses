import type { Trip, Participant, Expense, Beneficiary, Operation } from '$lib/backend';

// Reconstruit l'état d'un séjour en REPLIANT le journal `operations` (event sourcing,
// Degré 1 : modèle de LECTURE parallèle, validé identique aux tables). Fonction PURE,
// sans dépendance → réutilisable côté client (offline / undo) et, tel quel, dans une
// edge function TS plus tard. Prérequis « journaliser tout » (migration 0009) : les
// noms (persons/households) et réglages (trips) sont désormais dans le journal.
//
// ⚠️ N'est complet que pour un séjour créé APRÈS la mise en place des triggers (0009) ;
// un séjour plus ancien n'a pas d'événement `create` pour trip/person/household → il
// faudrait d'abord « amorcer » le log (hors périmètre ici).

export type FoldedTrip = {
	trip: Trip | null;
	participants: Participant[];
	expenses: Expense[];
	beneficiaries: Beneficiary[];
};

// Formes des snapshots `after` (sous-ensemble utile de `to_jsonb(row)` / save_expense).
type NamedRow = { name: string };
type ParticipantRow = {
	id: string;
	person_id: string;
	household_id: string;
	default_weight: number | string;
	active: boolean;
	invite_token: string;
};
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
	expense_id: string;
	person_id: string;
	is_locked: boolean;
	weight: number | null;
	amount_cents: number;
};
type ExpensePayload = { expense: ExpenseRow; beneficiaries: BeneficiaryRow[] };

export function foldTrip(ops: Operation[]): FoldedTrip {
	// Rejeu dans l'ordre du séujour (le serveur est le sérialiseur : `id` croissant).
	const ordered = [...ops].sort((a, b) => a.id - b.id);

	let trip: Trip | null = null;
	const persons = new Map<string, string>(); // id → name
	const households = new Map<string, string>(); // id → name
	const participants = new Map<string, ParticipantRow>();
	const expenses = new Map<string, ExpensePayload>();

	for (const op of ordered) {
		const id = op.entity_id;
		if (id == null) continue;

		if (op.action === 'delete') {
			// Tombstone : on retire l'entité (dernier événement gagne).
			if (op.entity_type === 'trip') trip = null;
			else if (op.entity_type === 'person') persons.delete(id);
			else if (op.entity_type === 'household') households.delete(id);
			else if (op.entity_type === 'participant') participants.delete(id);
			else if (op.entity_type === 'expense') expenses.delete(id);
			continue;
		}

		// create / update → `after` = état complet de l'entité (state-transfer).
		const after = op.after;
		if (after == null) continue;
		if (op.entity_type === 'trip') trip = after as Trip;
		else if (op.entity_type === 'person') persons.set(id, (after as NamedRow).name);
		else if (op.entity_type === 'household') households.set(id, (after as NamedRow).name);
		else if (op.entity_type === 'participant') participants.set(id, after as ParticipantRow);
		else if (op.entity_type === 'expense') expenses.set(id, after as ExpensePayload);
	}

	// Participants ENRICHIS des noms (personne + foyer) — c'est là que « journaliser
	// tout » paie : les noms sont maintenant reconstituables depuis le journal.
	const participantList: Participant[] = [...participants.values()].map((p) => ({
		participant_id: p.id,
		person_id: p.person_id,
		person_name: persons.get(p.person_id) ?? '?',
		household_id: p.household_id,
		household_name: households.get(p.household_id) ?? '?',
		default_weight: Number(p.default_weight),
		active: p.active,
		invite_token: p.invite_token
	}));

	const expenseList: Expense[] = [...expenses.values()].map((e) => ({
		id: e.expense.id,
		description: e.expense.description,
		category: e.expense.category,
		amount_cents: e.expense.amount_cents,
		spent_on: e.expense.spent_on,
		paid_by_person_id: e.expense.paid_by_person_id,
		version: e.expense.version
	}));

	const beneficiaryList: Beneficiary[] = [...expenses.values()].flatMap((e) =>
		e.beneficiaries.map((b) => ({
			expense_id: b.expense_id,
			person_id: b.person_id,
			is_locked: b.is_locked,
			weight: b.weight,
			amount_cents: b.amount_cents
		}))
	);

	return { trip, participants: participantList, expenses: expenseList, beneficiaries: beneficiaryList };
}
