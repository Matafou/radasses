// Adaptateur Firebase (Firestore + Auth anonyme) : réalise l'interface `Backend` en
// regroupant les fonctions de ce dossier. Seul cet adaptateur connaît le SDK `firebase`.
// La logique métier autrefois en SQL (répartition, verrou de version, journal) vit
// ici, dans des transactions Firestore ; les règles (`firestore.rules`) gardent l'accès.
import type { Backend } from '../index';
import {
	ensureSession,
	redeemToken,
	listJoinCandidates,
	claimParticipant,
	getMyPersonId
} from './auth';
import {
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
	setParticipantHousehold
} from './db';
import { saveExpense, deleteExpense } from './expenses';

export const firebaseBackend: Backend = {
	ensureSession,
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
