import { resolveSplit } from '$lib/split';
import { todayISO } from '$lib/date';
import { BackendError } from '../errors';
import { validation } from './errors';
import { journaled, txGet } from './journal';
import { expensePayload, nowIso, sub, type ExpenseDoc } from './model';
import { requireUid } from './auth';
import type { SaveExpenseInput, SaveExpenseResult } from '../types';

const conflict = (expected: number, actual: number) =>
	new BackendError(
		'conflict',
		`Conflit : la dépense a été modifiée entre-temps (version attendue ${expected}, actuelle ${actual}).`
	);

/**
 * Crée ou met à jour une dépense : répartition (`resolveSplit`), verrou optimiste
 * (`expected_version`) et entrée de journal `{expense, beneficiaries}`, atomiquement.
 */
export async function saveExpense(input: SaveExpenseInput): Promise<SaveExpenseResult> {
	const split = resolveSplit(input.amount_cents, input.beneficiaries);
	if (split.error !== undefined) throw validation(split.error);
	const { beneficiaries } = split;
	const uid = await requireUid();
	const t = input.trip_id;

	return journaled(t, async ({ tx, log }) => {
		const now = nowIso();
		const fields = {
			trip_id: t,
			description: input.description ?? '',
			category: input.category ?? null,
			amount_cents: input.amount_cents,
			spent_on: input.spent_on || todayISO(),
			paid_by_person_id: input.paid_by_person_id,
			updated_at: now,
			beneficiaries
		};

		if (input.expense_id) {
			const id = input.expense_id;
			const before = await txGet<ExpenseDoc>(tx, sub(t, 'expenses', id));
			if (!before) throw validation('Dépense introuvable dans ce séjour.');
			if (input.expected_version != null && input.expected_version !== before.version)
				throw conflict(input.expected_version, before.version);
			const after: ExpenseDoc = { ...before, ...fields, version: before.version + 1 };
			tx.set(sub(t, 'expenses', id), after);
			log({
				entity_type: 'expense',
				entity_id: id,
				action: 'update',
				before: expensePayload(id, before),
				after: expensePayload(id, after)
			});
			return { expense_id: id, version: after.version, beneficiaries };
		}

		const id = input.client_id ?? crypto.randomUUID();
		if (input.client_id) {
			// Rejeu (outbox) d'une création déjà enregistrée : idempotent.
			const existing = await txGet<ExpenseDoc>(tx, sub(t, 'expenses', id));
			if (existing)
				return {
					expense_id: id,
					version: existing.version,
					beneficiaries: existing.beneficiaries
				};
		}
		const created: ExpenseDoc = {
			...fields,
			version: 1,
			created_by: uid,
			created_at: now,
			deleted_at: null
		};
		tx.set(sub(t, 'expenses', id), created);
		log({
			entity_type: 'expense',
			entity_id: id,
			action: 'create',
			before: null,
			after: expensePayload(id, created)
		});
		return { expense_id: id, version: 1, beneficiaries };
	});
}

/**
 * Supprime LOGIQUEMENT une dépense (`deleted_at`). `expected_version` protège contre
 * la suppression d'une version périmée (erreur `conflict`) ; null = sans verrou.
 */
export async function deleteExpense(params: {
	trip_id: string;
	expense_id: string;
	expected_version?: number | null;
}): Promise<{ expense_id: string; deleted: boolean }> {
	const t = params.trip_id;
	const id = params.expense_id;
	return journaled(t, async ({ tx, log }) => {
		const before = await txGet<ExpenseDoc>(tx, sub(t, 'expenses', id));
		if (!before) throw validation('Dépense introuvable dans ce séjour.');
		if (before.deleted_at != null) throw validation('Dépense déjà supprimée.');
		if (params.expected_version != null && params.expected_version !== before.version)
			throw conflict(params.expected_version, before.version);
		const now = nowIso();
		tx.set(sub(t, 'expenses', id), {
			...before,
			deleted_at: now,
			updated_at: now,
			version: before.version + 1
		});
		log({
			entity_type: 'expense',
			entity_id: id,
			action: 'delete',
			before: expensePayload(id, before),
			after: null
		});
		return { expense_id: id, deleted: true };
	});
}
