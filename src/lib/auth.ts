import { supabase } from './supabase';

/**
 * Garantit qu'une session existe. Si aucune, ouvre une session ANONYME
 * (aucun écran de login, aucun mot de passe). L'identité est stockée dans
 * le navigateur ; on la relie à un participant via `redeemToken`.
 */
export async function ensureSession() {
	const { data } = await supabase.auth.getSession();
	if (data.session) return data.session;

	const { data: signed, error } = await supabase.auth.signInAnonymously();
	if (error) throw error;
	return signed.session;
}

/**
 * Rattache la session courante au participant désigné par le jeton
 * d'invitation présent dans l'URL. Idempotent (rejouable sur un autre
 * appareil). Renvoie l'id du séjour rejoint.
 */
export async function redeemToken(token: string): Promise<string> {
	await ensureSession();
	const { data, error } = await supabase.rpc('redeem_token', { p_token: token });
	if (error) throw error;
	return data as string;
}

/**
 * Crée un nouveau séjour + le premier participant (moi), et renvoie
 * { trip_id, participant_id, token } — le `token` est le lien à partager
 * pour rejoindre en tant que ce participant.
 */
export async function createTrip(params: {
	name: string;
	currency?: string;
	myName: string;
	myHouseholdName?: string;
}): Promise<{ trip_id: string; participant_id: string; token: string }> {
	await ensureSession();
	const { data, error } = await supabase.rpc('create_trip', {
		p_name: params.name,
		p_currency: params.currency ?? 'EUR',
		p_my_name: params.myName,
		p_my_household_name: params.myHouseholdName ?? null
	});
	if (error) throw error;
	return data as { trip_id: string; participant_id: string; token: string };
}
