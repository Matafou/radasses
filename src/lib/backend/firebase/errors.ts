import { BackendError, type BackendErrorCode } from '../errors';

// Codes Firestore (`FirestoreError.code`) et Auth (`AuthError.code`, préfixés `auth/`).
const FIRESTORE_CODES: Record<string, BackendErrorCode> = {
	unavailable: 'network',
	'deadline-exceeded': 'network',
	'permission-denied': 'forbidden',
	unauthenticated: 'forbidden',
	'not-found': 'not-found',
	aborted: 'conflict',
	'invalid-argument': 'validation',
	'failed-precondition': 'validation'
};

const AUTH_CODES: Record<string, BackendErrorCode> = {
	'auth/network-request-failed': 'network',
	'auth/admin-restricted-operation': 'forbidden',
	'auth/operation-not-allowed': 'forbidden'
};

/** Traduit toute erreur du SDK Firebase en `BackendError` (idempotent). */
export function toBackendError(e: unknown): BackendError {
	if (e instanceof BackendError) return e;
	const code = (e as { code?: unknown })?.code;
	const message = e instanceof Error ? e.message : String(e);
	if (typeof code === 'string') {
		const mapped = FIRESTORE_CODES[code] ?? AUTH_CODES[code];
		if (mapped) return new BackendError(mapped, message, { cause: e });
	}
	// fetch/réseau hors SDK (ex. TypeError « Failed to fetch »)
	if (/fetch|network|offline/i.test(message))
		return new BackendError('network', message, { cause: e });
	return new BackendError('unknown', message, { cause: e });
}

/** Erreur métier (entrée rejetée) : équivalent des `raise exception` SQL. */
export const validation = (message: string) => new BackendError('validation', message);
