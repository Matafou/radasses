import { supabase } from './client';
import { ensureSession } from './auth';
import { toBackendError } from './errors';
import type { SaveExpenseInput, SaveExpenseResult } from '../types';

/** Crée ou met à jour une dépense (calcul du split + verrou + journal côté serveur). */
export async function saveExpense(input: SaveExpenseInput): Promise<SaveExpenseResult> {
	await ensureSession();
	const { data, error } = await supabase.rpc('save_expense', {
		p_trip_id: input.trip_id,
		p_amount_cents: input.amount_cents,
		p_paid_by_person_id: input.paid_by_person_id,
		p_beneficiaries: input.beneficiaries,
		p_description: input.description ?? '',
		p_category: input.category ?? null,
		p_spent_on: input.spent_on ?? null,
		p_expense_id: input.expense_id ?? null,
		p_expected_version: input.expected_version ?? null
	});
	if (error) throw toBackendError(error);
	return data as SaveExpenseResult;
}

/**
 * Supprime (logiquement) une dépense. `expected_version` protège contre
 * la suppression d'une version périmée (erreur de conflit sinon).
 */
export async function deleteExpense(params: {
	trip_id: string;
	expense_id: string;
	expected_version?: number | null;
}): Promise<{ expense_id: string; deleted: boolean }> {
	await ensureSession();
	const { data, error } = await supabase.rpc('delete_expense', {
		p_trip_id: params.trip_id,
		p_expense_id: params.expense_id,
		p_expected_version: params.expected_version ?? null
	});
	if (error) throw toBackendError(error);
	return data as { expense_id: string; deleted: boolean };
}
