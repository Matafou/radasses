import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import {
	backend,
	BackendError,
	type Trip,
	type Participant,
	type Expense,
	type Beneficiary,
	type Balance,
	type SaveExpenseInput
} from '$lib/backend';
import { simplifyDebts } from './settlements';

/** Sections rechargeables indépendamment (voir `load`). */
type LoadSection = 'trip' | 'participants' | 'expenses' | 'beneficiaries' | 'balances' | 'me';
const ALL_SECTIONS: readonly LoadSection[] = [
	'trip',
	'participants',
	'expenses',
	'beneficiaries',
	'balances',
	'me'
];

/** Pré-remplissage du mini-formulaire de remboursement (depuis une suggestion de l'onglet Soldes). */
export type ReimbursePrefill = {
	from_person_id?: string;
	to_person_id?: string;
	amount_cents?: number;
};

/**
 * État partagé d'un séjour : chargé une fois par le layout /t/[tripId] et
 * consommé par les onglets (Dépenses, Soldes, Participants) via le contexte.
 * Les mutations rechargent l'ensemble.
 */
export class TripState {
	/** remboursement en cours de saisie (mini-formulaire) ; null = mode dépense normale */
	reimburse = $state<ReimbursePrefill | null>(null);
	/** dépense en cours d'édition — persiste au changement d'onglet */
	editingExpense = $state<Expense | null>(null);
	/** le bottom-sheet de dépense (dans le layout) est-il déployé ? */
	formOpen = $state(false);
	/** une saisie de création est en cours (renseigné par ExpenseForm) → bouton « Reprendre » */
	hasCreateDraft = $state(false);
	/** incrémenté à l'abandon/validation pour forcer un formulaire de création vierge la fois suivante */
	formSeq = $state(0);
	tripId = $state('');
	loading = $state(true);
	error = $state<string | null>(null);
	trip = $state<Trip | null>(null);
	participants = $state<Participant[]>([]);
	expenses = $state<Expense[]>([]);
	beneficiaries = $state<Beneficiary[]>([]);
	balances = $state<Balance[]>([]);
	myPersonId = $state<string | null>(null);

	currency = $derived(this.trip?.currency ?? 'EUR');
	personName = $derived(new SvelteMap(this.participants.map((p) => [p.person_id, p.person_name])));
	householdName = $derived(
		new SvelteMap(this.participants.map((p) => [p.household_id, p.household_name]))
	);
	households = $derived(Array.from(this.householdName, ([id, name]) => ({ id, name })));
	transfers = $derived(simplifyDebts(this.balances));
	benefByExpense = $derived.by(() => {
		const m = new SvelteMap<string, Beneficiary[]>();
		for (const b of this.beneficiaries) {
			const arr = m.get(b.expense_id);
			if (arr) arr.push(b);
			else m.set(b.expense_id, [b]);
		}
		return m;
	});

	async setTrip(id: string) {
		this.tripId = id;
		await this.load();
	}

	/**
	 * (Re)charge le séjour. Par défaut tout ; on peut ne recharger que les
	 * sections touchées par une mutation pour éviter de relancer les ~6
	 * requêtes à chaque fois. Le sentinelle `undefined` (jamais renvoyé par le
	 * backend, `myPersonId` valant `null` au plus) distingue « non demandé » de
	 * « valeur récupérée ». Un rechargement partiel ne touche pas à `loading`
	 * (pas de spinner plein écran après une simple mutation).
	 */
	async load(sections: readonly LoadSection[] = ALL_SECTIONS) {
		const id = this.tripId;
		if (!id) return;
		const want = (s: LoadSection) => sections.includes(s);
		const full = sections === ALL_SECTIONS;
		if (full) this.loading = true;
		this.error = null;
		try {
			const [trip, participants, expenses, beneficiaries, balances, myPersonId] = await Promise.all(
				[
					want('trip') ? backend.getTrip(id) : undefined,
					want('participants') ? backend.listParticipants(id) : undefined,
					want('expenses') ? backend.listExpenses(id) : undefined,
					want('beneficiaries') ? backend.listBeneficiaries(id) : undefined,
					want('balances') ? backend.getBalances(id) : undefined,
					want('me') ? backend.getMyPersonId(id) : undefined
				]
			);
			if (trip !== undefined) this.trip = trip;
			if (participants !== undefined) this.participants = participants;
			if (expenses !== undefined) this.expenses = expenses;
			if (beneficiaries !== undefined) this.beneficiaries = beneficiaries;
			if (balances !== undefined) this.balances = balances;
			if (myPersonId !== undefined) this.myPersonId = myPersonId;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			if (full) this.loading = false;
		}
	}

	/**
	 * En cas de conflit de version (donnée modifiée entre-temps), on recharge le
	 * séjour pour repartir de l'état à jour, puis on laisse l'erreur remonter à
	 * l'appelant (qui affiche le message).
	 */
	private async withConflictReload<T>(op: () => Promise<T>): Promise<T> {
		try {
			return await op();
		} catch (e) {
			if (e instanceof BackendError && e.code === 'conflict') await this.load();
			throw e;
		}
	}

	/** Crée (sans expense_id) ou met à jour (avec expense_id + expected_version). */
	async upsertExpense(input: Omit<SaveExpenseInput, 'trip_id'>) {
		await this.withConflictReload(() => backend.saveExpense({ trip_id: this.tripId, ...input }));
		await this.load(['expenses', 'beneficiaries', 'balances']);
	}
	async removeExpense(exp: Expense) {
		await this.withConflictReload(() =>
			backend.deleteExpense({
				trip_id: this.tripId,
				expense_id: exp.id,
				expected_version: exp.version
			})
		);
		await this.load(['expenses', 'beneficiaries', 'balances']);
	}

	/** Déploie le formulaire pour une nouvelle dépense (reprend une saisie en cours si présente). */
	openNewExpense() {
		this.editingExpense = null;
		this.reimburse = null;
		this.formOpen = true;
	}
	/** Déploie le formulaire pré-rempli avec une dépense existante à modifier. */
	openEditExpense(e: Expense) {
		this.reimburse = null;
		this.editingExpense = e;
		this.formOpen = true;
	}
	/** Déploie le mini-formulaire de remboursement (préremplissable depuis une suggestion). */
	openReimbursement(prefill: ReimbursePrefill = {}) {
		this.editingExpense = null;
		this.reimburse = prefill;
		this.formOpen = true;
	}
	/** Masque le formulaire SANS perdre la saisie (le composant reste monté) → « Reprendre ». */
	hideExpenseForm() {
		this.formOpen = false;
	}
	/** Referme ET abandonne : réarme un formulaire de création vierge pour la prochaine ouverture. */
	closeExpenseForm() {
		this.editingExpense = null;
		this.reimburse = null;
		this.formOpen = false;
		this.hasCreateDraft = false;
		this.formSeq++;
	}
	async newParticipant(params: { person_name: string; household_id?: string | null }) {
		await backend.addParticipant({ trip_id: this.tripId, ...params });
		// un nouveau foyer ajoute une ligne (solde 0) à la vue balances
		await this.load(['participants', 'balances']);
	}
	/**
	 * Met à jour un participant depuis l'écran d'édition : renomme la personne
	 * (`person_name` fourni) et/ou le déplace de foyer (`move_household_id` fourni :
	 * un id existant, ou `null` = nouveau foyer nommé `new_household_name`). Chaque
	 * champ est optionnel → on n'écrit que ce qui a changé (évite une entrée de
	 * journal superflue). Un seul rechargement pour les deux.
	 */
	async updateParticipant(params: {
		person_id: string;
		participant_id: string;
		person_name?: string;
		move_household_id?: string | null;
		new_household_name?: string;
	}) {
		if (params.person_name != null) {
			await backend.updatePersonName(params.person_id, params.person_name);
		}
		if (params.move_household_id !== undefined) {
			await backend.setParticipantHousehold({
				participant_id: params.participant_id,
				household_id: params.move_household_id,
				household_name: params.new_household_name
			});
		}
		// le déplacement de foyer est rétroactif (soldes joints par foyer courant)
		await this.load(['participants', 'balances']);
	}
	/** Marque un participant présent (active=true) ou parti (false). */
	async setActive(participantId: string, active: boolean) {
		await backend.setParticipantActive(participantId, active);
		// `active` n'entre pas dans le calcul des soldes existants
		await this.load(['participants']);
	}
	/** Réglages du séjour (nom, devise). */
	async updateSettings(patch: { name?: string; currency?: string }) {
		await backend.updateTrip(this.tripId, patch);
		await this.load(['trip']);
	}
}

const KEY = Symbol('trip');
export function setTripState(s: TripState) {
	setContext(KEY, s);
}
export function getTripState(): TripState {
	return getContext(KEY) as TripState;
}
