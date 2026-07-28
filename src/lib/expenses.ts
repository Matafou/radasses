import { supabase } from './supabase';
import { ensureSession } from './auth';

/** Un bénéficiaire tel que saisi (avant résolution des montants par le backend). */
export type BeneficiaryInput = {
	person_id: string;
	/** true = montant fixé manuellement (invariable) ; false/absent = proportionnel */
	is_locked?: boolean;
	/** poids (parts relatives) quand non verrouillé ; null/absent = parts égales */
	weight?: number | null;
	/** requis (en centimes) si is_locked */
	amount_cents?: number;
};

export type SaveExpenseInput = {
	trip_id: string;
	amount_cents: number;
	paid_by_person_id: string;
	beneficiaries: BeneficiaryInput[];
	description?: string;
	category?: string | null;
	/** 'YYYY-MM-DD' ; défaut = aujourd'hui */
	spent_on?: string | null;
	/** null = création ; sinon édition de cette dépense */
	expense_id?: string | null;
	/** version attendue (verrou optimiste) — requise pour une édition sûre */
	expected_version?: number | null;
};

export type ResolvedBeneficiary = {
	person_id: string;
	is_locked: boolean;
	weight: number | null;
	amount_cents: number;
};

export type SaveExpenseResult = {
	expense_id: string;
	version: number;
	beneficiaries: ResolvedBeneficiary[];
};

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
	if (error) throw error;
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
	if (error) throw error;
	return data as { expense_id: string; deleted: boolean };
}
