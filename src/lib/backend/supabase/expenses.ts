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
		p_category: input.category ?? undefined,
		p_spent_on: input.spent_on ?? undefined,
		p_expense_id: input.expense_id ?? undefined,
		p_expected_version: input.expected_version ?? undefined
	});
	if (error) throw toBackendError(error);
	// `save_expense` renvoie `jsonb` côté SQL → typé `Json` (non structuré) ; cast
	// vers la forme réellement construite par `jsonb_build_object(...)` (0007).
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
		p_expected_version: params.expected_version ?? undefined
	});
	if (error) throw toBackendError(error);
	// `delete_expense` renvoie `jsonb` côté SQL → typé `Json` (non structuré) ; cast
	// vers la forme réellement construite par `jsonb_build_object(...)` (0007).
	return data as { expense_id: string; deleted: boolean };
}
