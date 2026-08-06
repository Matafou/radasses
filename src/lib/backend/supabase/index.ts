// Adaptateur Supabase : réalise l'interface `Backend` en regroupant les
// fonctions de ce dossier. Seul cet adaptateur connaît `@supabase/supabase-js`.
import type { Backend } from '../index';
import { BackendError } from '../errors';
import { ensureSession, redeemToken, createTrip, addParticipant, repairOrphanedSession } from './auth';
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

// Filet « session orpheline » : si une opération échoue parce que la session
// locale désigne un utilisateur d'auth disparu (après un `db reset` du cloud),
// on répare et on recharge la page (voir `repairOrphanedSession`). Appliqué
// uniformément à TOUTES les méthodes ci-dessous — un seul point de branchement.
// Le rechargement interrompt l'exécution ; le `throw e` ne compte que si la
// réparation est refusée (déjà tentée sur ce chargement) → l'erreur remonte à
// l'UI avec un message clair.
function withSessionRepair<A extends unknown[], R>(
	fn: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
	return async (...args: A) => {
		try {
			return await fn(...args);
		} catch (e) {
			if (e instanceof BackendError && e.code === 'orphaned-session') {
				await repairOrphanedSession();
			}
			throw e;
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
