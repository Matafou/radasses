// Erreur normalisée, indépendante du fournisseur. Chaque adaptateur traduit
// ses erreurs natives en `BackendError` (voir `supabase/errors.ts`), pour que
// l'UI n'ait jamais à connaître les codes/messages spécifiques d'un provider.

export type BackendErrorCode =
	/** conflit de version (donnée modifiée entre-temps) */
	| 'conflict'
	/**
	 * session orpheline : l'utilisateur d'auth de la session locale n'existe plus
	 * côté serveur (typiquement après un `db reset` du cloud). Le backend s'en
	 * répare tout seul (nouvelle session anonyme + rechargement) ; ce code n'est
	 * visible que si la réparation a déjà été tentée sur ce chargement.
	 */
	| 'orphaned-session'
	/** accès refusé (droits insuffisants) */
	| 'forbidden'
	/** entrée invalide rejetée par une règle métier */
	| 'validation'
	/** ressource introuvable */
	| 'not-found'
	/** problème réseau (requête non aboutie) */
	| 'network'
	/**
	 * « JWT issued at future » : micro-désynchro d'horloge (GoTrue ↔ PostgREST) → un
	 * jeton fraîchement émis a un `iat` que le validateur n'a pas encore dépassé. Erreur
	 * TRANSITOIRE : le filet réessaie après un court délai (voir `withSessionRepair`).
	 */
	| 'clock-skew'
	/** cas non classé */
	| 'unknown';

/** Étend `Error` : `error.message` reste utilisable partout où l'UI l'affiche déjà. */
export class BackendError extends Error {
	readonly code: BackendErrorCode;

	constructor(code: BackendErrorCode, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'BackendError';
		this.code = code;
	}
}
