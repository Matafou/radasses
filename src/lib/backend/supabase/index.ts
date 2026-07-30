// Adaptateur Supabase : réalise l'interface `Backend` en regroupant les
// fonctions de ce dossier. Seul cet adaptateur connaît `@supabase/supabase-js`.
import type { Backend } from '../index';
import { ensureSession, redeemToken, createTrip, addParticipant } from './auth';
import {
	getTrip,
	listParticipants,
	listExpenses,
	listBeneficiaries,
	getBalances,
	listSettlements,
	listOperations,
	listActors,
	getMyPersonId,
	updateTrip,
	updatePersonName,
	updateHouseholdName,
	setParticipantActive
} from './db';
import { saveExpense, deleteExpense } from './expenses';
import { recordSettlement, cancelSettlement } from './settlements';

export const supabaseBackend: Backend = {
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
	listSettlements,
	listOperations,
	listActors,
	updateTrip,
	updatePersonName,
	updateHouseholdName,
	setParticipantActive,
	saveExpense,
	deleteExpense,
	recordSettlement,
	cancelSettlement
};
