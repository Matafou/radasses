import { BackendError } from '../errors';

// Traduit une erreur Supabase (PostgrestError / AuthError / échec réseau) en
// `BackendError`. C'est le SEUL endroit qui connaît les SQLSTATE Postgres et
// les particularités du provider.

/** Forme minimale commune aux erreurs supabase-js (PostgrestError, AuthError). */
type RawError = { message?: string; code?: string; name?: string };

// supabase-js ne « throw » pas sur échec réseau : il renvoie une erreur dont le
// SQLSTATE est absent et dont le message trahit l'échec fetch.
function isNetwork(message: string, sqlstate?: string): boolean {
	if (sqlstate) return false;
	return /failed to fetch|networkerror|fetch|load failed/i.test(message);
}

export function toBackendError(err: unknown): BackendError {
	if (err instanceof BackendError) return err;

	const e = (err ?? {}) as RawError;
	const message = e.message ?? String(err);
	const sqlstate = e.code;

	if (isNetwork(message, sqlstate)) {
		return new BackendError('network', 'Problème de connexion. Réessaie dans un instant.', {
			cause: err
		});
	}

	switch (sqlstate) {
		case 'PT409': // verrou optimiste (mappé HTTP 409 par PostgREST)
		case '40001': // serialization_failure — plus utilisé, gardé par sécurité
			return new BackendError(
				'conflict',
				'Cet élément a été modifié entre-temps : recharge la page avant de réessayer.',
				{ cause: err }
			);
		case '42501': // insufficient_privilege
			return new BackendError('forbidden', 'Accès refusé à ce séjour.', { cause: err });
		case 'P0001': // raise exception sans errcode → nos validations métier (déjà en français)
			return new BackendError('validation', message, { cause: err });
		case 'PGRST116': // aucune/plusieurs lignes là où une seule était attendue
			return new BackendError('not-found', 'Élément introuvable.', { cause: err });
	}

	return new BackendError('unknown', message || 'Une erreur est survenue.', { cause: err });
}
