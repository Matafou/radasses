// Adaptateur Supabase : réalise l'interface `Backend` en regroupant les
// fonctions de ce dossier. Seul cet adaptateur connaît `@supabase/supabase-js`.
import type { Backend } from '../index';
import { BackendError } from '../errors';
import {
	ensureSession,
	redeemToken,
	listJoinCandidates,
	claimParticipant,
	createTrip,
	addParticipant,
	repairOrphanedSession
} from './auth';
import {
	getTrip,
	listParticipants,
	listExpenses,
	listBeneficiaries,
	getBalances,
	listOperations,
	listActors,
	getMyPersonId,
	updateTrip,
	updatePersonName,
	updateHouseholdName,
	setParticipantActive,
	setParticipantDefaultWeight,
	setParticipantHousehold
} from './db';
import { saveExpense, deleteExpense } from './expenses';

// Filet de résilience appliqué uniformément à TOUTES les méthodes (un seul point) :
//  - « session orpheline » (utilisateur d'auth disparu après un `db reset` du cloud) →
//    on répare + recharge la page (voir `repairOrphanedSession`) ; le `throw e` ne compte
//    que si la réparation est refusée (déjà tentée sur ce chargement).
//  - « JWT issued at future » (micro-désynchro d'horloge GoTrue↔PostgREST, code
//    `clock-skew`) → transitoire : on attend un court instant que l'horloge du validateur
//    dépasse l'`iat`, puis on RÉESSAIE (borné à 2 fois). Indépendant de l'horloge locale,
//    et couvre aussi bien le démarrage que le rafraîchissement silencieux du jeton.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withSessionRepair<A extends unknown[], R>(
	fn: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
	return async (...args: A) => {
		for (let attempt = 0; ; attempt++) {
			try {
				return await fn(...args);
			} catch (e) {
				if (e instanceof BackendError && e.code === 'orphaned-session') {
					await repairOrphanedSession();
					throw e;
				}
				if (e instanceof BackendError && e.code === 'clock-skew' && attempt < 2) {
					await sleep(1500);
					continue;
				}
				throw e;
			}
		}
	};
}

const raw: Backend = {
	// Le `ensureSession` interne renvoie la session (utilisée par les autres
	// modules de l'adaptateur) ; l'interface publique n'expose que `Promise<void>`.
	ensureSession: async () => {
		await ensureSession();
	},
	redeemToken,
	listJoinCandidates,
	claimParticipant,
	getMyPersonId,
	createTrip,
	addParticipant,
	getTrip,
	listParticipants,
	listExpenses,
	listBeneficiaries,
	getBalances,
	listOperations,
	listActors,
	updateTrip,
	updatePersonName,
	updateHouseholdName,
	setParticipantActive,
	setParticipantDefaultWeight,
	setParticipantHousehold,
	saveExpense,
	deleteExpense
};

// Enveloppe chaque méthode de `obj` avec `wrap`, en préservant sa signature EXACTE
// (contrairement à un aller-retour Object.entries/fromEntries, qui unifie toutes les
// valeurs sous un seul type générique et perd la correspondance clé → signature :
// il faudrait alors un cast final `as unknown as Backend` non vérifié). Ici, le
// type de retour est `T` (celui de `obj`) : si une méthode dérive de l'interface
// `Backend`, l'erreur remonte sur l'affectation `supabaseBackend: Backend = …`
// ci-dessous, même si l'annotation `raw: Backend` venait à disparaître.
function wrapAll<T extends object>(
	obj: T,
	wrap: <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => (...args: A) => Promise<R>
): T {
	const out = {} as T;
	for (const k of Object.keys(obj) as (keyof T)[]) {
		out[k] = wrap(obj[k] as (...args: unknown[]) => Promise<unknown>) as T[keyof T];
	}
	return out;
}

export const supabaseBackend: Backend = wrapAll(raw, withSessionRepair);
