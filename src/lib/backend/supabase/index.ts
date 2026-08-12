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

export const supabaseBackend: Backend = Object.fromEntries(
	Object.entries(raw).map(([name, fn]) => [
		name,
		withSessionRepair(fn as (...args: unknown[]) => Promise<unknown>)
	])
) as unknown as Backend;
