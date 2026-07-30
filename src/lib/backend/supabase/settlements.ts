import { supabase } from './client';
import { ensureSession } from './auth';
import { toBackendError } from './errors';

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
	if (error) throw toBackendError(error);
}

/** Annule (suppression logique) un remboursement enregistré. */
export async function cancelSettlement(id: string): Promise<void> {
	await ensureSession();
	const { error } = await supabase
		.from('settlements')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id);
	if (error) throw toBackendError(error);
}
