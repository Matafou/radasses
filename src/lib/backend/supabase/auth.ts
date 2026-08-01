import { supabase } from './client';
import { toBackendError } from './errors';

/** Décode l'`iat` (émis-le, en secondes) d'un JWT, ou null si illisible. */
function jwtIssuedAt(token: string): number | null {
	try {
		const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
		const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
		const iat = JSON.parse(atob(padded)).iat;
		return typeof iat === 'number' ? iat : null;
	} catch {
		return null;
	}
}

/**
 * Garantit qu'une session existe. Si aucune, ouvre une session ANONYME
 * (aucun écran de login, aucun mot de passe). L'identité est stockée dans
 * le navigateur ; on la relie à un participant via `redeemToken`.
 */
export async function ensureSession() {
	const { data } = await supabase.auth.getSession();
	let session = data.session;
	if (!session) {
		const { data: signed, error } = await supabase.auth.signInAnonymously();
		if (error) throw toBackendError(error);
		session = signed.session;
	}

	// Parade « JWT issued at future » : par micro-désynchro d'horloge (serveurs
	// Supabase ↔ appareil), un jeton fraîchement émis peut avoir un `iat` dans le
	// futur ; le serveur le rejette tant que son horloge ne l'a pas dépassé (erreur
	// intermittente, indépendante de l'horloge de l'appareil). On attend donc que le
	// jeton devienne valide AVANT que l'app s'en serve, plafonné à 2 s pour ne jamais
	// bloquer longtemps. Cas normal (iat déjà passé) → aucune attente.
	const iat = session?.access_token ? jwtIssuedAt(session.access_token) : null;
	if (iat != null) {
		const aheadMs = iat * 1000 - Date.now();
		if (aheadMs > 0) await new Promise((r) => setTimeout(r, Math.min(aheadMs + 250, 2000)));
	}

	return session;
}

/**
 * Rattache la session courante au participant désigné par le jeton
 * d'invitation présent dans l'URL. Idempotent (rejouable sur un autre
 * appareil). Renvoie l'id du séjour rejoint.
 */
export async function redeemToken(token: string): Promise<string> {
	await ensureSession();
	const { data, error } = await supabase.rpc('redeem_token', { p_token: token });
	if (error) throw toBackendError(error);
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
	if (error) throw toBackendError(error);
	return data as { trip_id: string; participant_id: string; token: string };
}

/**
 * Ajoute un participant au séjour : nouveau foyer, ou rattaché à un foyer
 * existant si `household_id` est fourni. Renvoie le jeton (lien à partager).
 */
export async function addParticipant(params: {
	trip_id: string;
	person_name: string;
	household_name?: string | null;
	household_id?: string | null;
	default_weight?: number;
}): Promise<{ participant_id: string; person_id: string; household_id: string; token: string }> {
	await ensureSession();
	const { data, error } = await supabase.rpc('add_participant', {
		p_trip_id: params.trip_id,
		p_person_name: params.person_name,
		p_household_name: params.household_name ?? null,
		p_household_id: params.household_id ?? null,
		p_default_weight: params.default_weight ?? 1
	});
	if (error) throw toBackendError(error);
	return data as { participant_id: string; person_id: string; household_id: string; token: string };
}
