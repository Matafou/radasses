// Types de domaine — indépendants du provider (Supabase ou autre).
// Aucune dépendance ici : ce sont les entités et entrées/sorties manipulées
// par l'application, quelle que soit l'implémentation du backend.

export type Trip = { id: string; name: string; currency: string; created_at: string };

export type Participant = {
	participant_id: string;
	person_id: string;
	person_name: string;
	household_id: string;
	household_name: string;
	default_weight: number;
	active: boolean;
	invite_token: string;
};

export type Expense = {
	id: string;
	description: string;
	category: string | null;
	amount_cents: number;
	spent_on: string;
	paid_by_person_id: string;
	version: number;
};

export type Beneficiary = {
	expense_id: string;
	person_id: string;
	is_locked: boolean;
	weight: number | null;
	amount_cents: number;
};

export type Balance = { household_id: string; net_cents: number };

export type Settlement = {
	id: string;
	from_household_id: string;
	to_household_id: string;
	amount_cents: number;
	settled_on: string;
};

export type Operation = {
	id: number;
	actor_auth_user_id: string | null;
	entity_type: string;
	entity_id: string | null;
	action: string;
	before: unknown;
	after: unknown;
	created_at: string;
};

/** Un bénéficiaire tel que saisi (avant résolution des montants par le backend). */
export type BeneficiaryInput = {
	person_id: string;
	/** true = montant fixé manuellement (invariable) ; false/absent = proportionnel */
	is_locked?: boolean;
	/** poids (parts relatives) quand non verrouillé ; null/absent = parts égales */
	weight?: number | null;
	/** requis (en centimes) si is_locked */
	amount_cents?: number;
};

export type SaveExpenseInput = {
	trip_id: string;
	amount_cents: number;
	paid_by_person_id: string;
	beneficiaries: BeneficiaryInput[];
	description?: string;
	category?: string | null;
	/** 'YYYY-MM-DD' ; défaut = aujourd'hui */
	spent_on?: string | null;
	/** null = création ; sinon édition de cette dépense */
	expense_id?: string | null;
	/** version attendue (verrou optimiste) — requise pour une édition sûre */
	expected_version?: number | null;
};

export type ResolvedBeneficiary = {
	person_id: string;
	is_locked: boolean;
	weight: number | null;
	amount_cents: number;
};

export type SaveExpenseResult = {
	expense_id: string;
	version: number;
	beneficiaries: ResolvedBeneficiary[];
};
