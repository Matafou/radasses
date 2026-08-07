// Point d'entrée unique de la couche « backend » (ports & adapters).
//
// L'application n'importe QUE ce module (`$lib/backend`) : jamais Supabase
// directement. Pour changer de fournisseur, il suffit d'écrire un nouvel
// adaptateur dans `./<provider>/` qui satisfait l'interface `Backend`, puis
// de changer la seule ligne `export const backend` ci-dessous.

import type {
	Balance,
	Beneficiary,
	Expense,
	JoinCandidate,
	Operation,
	Participant,
	SaveExpenseInput,
	SaveExpenseResult,
	Trip
} from './types';
import { supabaseBackend } from './supabase';

export * from './types';
export { BackendError, type BackendErrorCode } from './errors';

/**
 * Contrat que doit remplir tout fournisseur de données. C'est exactement la
 * surface dont l'application a besoin — ni plus, ni moins. Toute la spécificité
 * du provider (requêtes, auth, RPC…) est confinée derrière ces méthodes.
 */
export interface Backend {
	// --- Session / identité ---
	/** Garantit qu'une session existe (anonyme si besoin). */
	ensureSession(): Promise<void>;
	/** Rattache la session courante au participant du jeton ; renvoie l'id du séjour. */
	redeemToken(token: string): Promise<string>;
	/** Participants proposés au choix (« Qui es-tu ? ») pour le lien de séjour partageable. */
	listJoinCandidates(joinToken: string): Promise<JoinCandidate[]>;
	/** Rattache la session courante au participant CHOISI via le lien de séjour ; renvoie l'id du séjour. */
	claimParticipant(joinToken: string, participantId: string): Promise<string>;
	/** person_id de l'utilisateur courant dans ce séjour, ou null. */
	getMyPersonId(tripId: string): Promise<string | null>;

	// --- Création / participants ---
	createTrip(params: {
		name: string;
		currency?: string;
		myName: string;
		myHouseholdName?: string;
	}): Promise<{ trip_id: string; participant_id: string; token: string }>;
	addParticipant(params: {
		trip_id: string;
		person_name: string;
		household_name?: string | null;
		household_id?: string | null;
		default_weight?: number;
	}): Promise<{ participant_id: string; person_id: string; household_id: string; token: string }>;

	// --- Lectures ---
	getTrip(tripId: string): Promise<Trip | null>;
	listParticipants(tripId: string): Promise<Participant[]>;
	listExpenses(tripId: string): Promise<Expense[]>;
	listBeneficiaries(tripId: string): Promise<Beneficiary[]>;
	getBalances(tripId: string): Promise<Balance[]>;
	listOperations(tripId: string): Promise<Operation[]>;
	/** Table auth_user_id -> nom de la personne (pour afficher « qui » a agi). */
	listActors(tripId: string): Promise<Record<string, string>>;

	// --- Mutations directes ---
	updateTrip(tripId: string, patch: { name?: string; currency?: string }): Promise<void>;
	updatePersonName(personId: string, name: string): Promise<void>;
	updateHouseholdName(householdId: string, name: string): Promise<void>;
	setParticipantActive(participantId: string, active: boolean): Promise<void>;
	/** Poids par défaut du participant (parts relatives, > 0). */
	setParticipantDefaultWeight(participantId: string, weight: number): Promise<void>;
	/** Déplace un participant vers un foyer existant (`household_id`) ou un nouveau (null). */
	setParticipantHousehold(params: {
		participant_id: string;
		household_id?: string | null;
		household_name?: string | null;
	}): Promise<void>;

	// --- Dépenses (logique serveur : split, verrou optimiste, journal) ---
	saveExpense(input: SaveExpenseInput): Promise<SaveExpenseResult>;
	deleteExpense(params: {
		trip_id: string;
		expense_id: string;
		expected_version?: number | null;
	}): Promise<{ expense_id: string; deleted: boolean }>;
}

/** Fournisseur actif. Changer cette ligne suffit à basculer d'adaptateur. */
export const backend: Backend = supabaseBackend;
