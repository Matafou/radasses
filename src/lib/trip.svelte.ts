import { getContext, setContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import {
	backend,
	BackendError,
	type Trip,
	type Participant,
	type Expense,
	type Beneficiary,
	type SaveExpenseInput
} from '$lib/backend';
import { simplifyDebts } from './settlements';
import { computeBalances } from './balances';
import { previewSplit } from './split';
import { todayISO } from './date';
import { online } from './online.svelte';
import { outbox } from './outbox.svelte';
import { loadTripSnapshot, saveTripSnapshot, type TripSnapshot } from './offline-cache';
import { errMessage } from './util';

/** Sections rechargeables indépendamment (voir `load`). */
type LoadSection = 'trip' | 'participants' | 'expenses' | 'beneficiaries' | 'me';
const ALL_SECTIONS: readonly LoadSection[] = [
	'trip',
	'participants',
	'expenses',
	'beneficiaries',
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
	myPersonId = $state<string | null>(null);
	/** données servies depuis le cache local (hors-ligne) plutôt que du réseau */
	fromCache = $state(false);

	currency = $derived(this.trip?.currency ?? 'EUR');
	personName = $derived(new SvelteMap(this.participants.map((p) => [p.person_id, p.person_name])));
	householdName = $derived(
		new SvelteMap(this.participants.map((p) => [p.household_id, p.household_name]))
	);
	households = $derived(Array.from(this.householdName, ([id, name]) => ({ id, name })));
	// Dépenses « en attente de suppression » hors-ligne : dérivé de l'outbox (persistée).
	// Elles restent AFFICHÉES (médaillon « supprimé · à synchroniser ») mais sortent des
	// soldes ; elles disparaissent vraiment à la synchro (le serveur ne les renvoie plus).
	pendingDeleteIds = $derived(
		new SvelteSet(
			outbox.ops.flatMap((o) =>
				o.kind === 'deleteExpense' && o.tripId === this.tripId ? [o.expenseId] : []
			)
		)
	);
	/** Dépenses réellement vivantes (hors suppressions offline en attente) → soldes/détails. */
	liveExpenses = $derived(this.expenses.filter((e) => !this.pendingDeleteIds.has(e.id)));
	// Soldes recalculés LOCALEMENT depuis les données chargées (réplique de la vue SQL
	// `balances`) → toujours cohérents avec les dépenses, sans requête réseau dédiée.
	balances = $derived(computeBalances(this.participants, this.liveExpenses, this.beneficiaries));
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
		// Hors-ligne : servir directement le cache local, sans attendre l'échec réseau
		// (qui peut être lent). Si aucun cache, on tente quand même le réseau (l'heuristique
		// navigator.onLine peut se tromper).
		if (!online.current) {
			const snap = await loadTripSnapshot(id);
			if (snap) {
				this.hydrateFromSnapshot(snap);
				this.error = null;
				this.loading = false;
				return;
			}
		}
		if (full) this.loading = true;
		this.error = null;
		try {
			const [trip, participants, expenses, beneficiaries, myPersonId] = await Promise.all([
				want('trip') ? backend.getTrip(id) : undefined,
				want('participants') ? backend.listParticipants(id) : undefined,
				want('expenses') ? backend.listExpenses(id) : undefined,
				want('beneficiaries') ? backend.listBeneficiaries(id) : undefined,
				want('me') ? backend.getMyPersonId(id) : undefined
			]);
			if (trip !== undefined) this.trip = trip;
			if (participants !== undefined) this.participants = participants;
			if (expenses !== undefined) this.expenses = expenses;
			if (beneficiaries !== undefined) this.beneficiaries = beneficiaries;
			if (myPersonId !== undefined) this.myPersonId = myPersonId;
			this.fromCache = false;
			this.persistSnapshot(); // write-through : dernier état connu en cache (offline)
		} catch (e) {
			// Réseau tombé alors qu'on se croyait en ligne : on hydrate depuis le cache
			// plutôt que d'afficher une erreur.
			if (e instanceof BackendError && e.code === 'network') {
				const snap = await loadTripSnapshot(id);
				if (snap) {
					this.hydrateFromSnapshot(snap);
					this.error = null;
					return;
				}
			}
			this.error = errMessage(e);
		} finally {
			if (full) this.loading = false;
		}
	}

	/** Peuple l'état depuis un instantané en cache (lecture hors-ligne). */
	private hydrateFromSnapshot(snap: TripSnapshot) {
		this.trip = snap.trip;
		this.participants = snap.participants;
		this.expenses = snap.expenses;
		this.beneficiaries = snap.beneficiaries;
		this.myPersonId = snap.myPersonId;
		this.fromCache = true;
	}

	/** Écrit l'état courant dans le cache local (`$state.snapshot` : les proxies runes
	 *  ne sont pas clonables par IndexedDB → sinon le `put` échoue silencieusement). */
	private persistSnapshot() {
		void saveTripSnapshot(
			this.tripId,
			$state.snapshot({
				trip: this.trip,
				participants: this.participants,
				expenses: this.expenses,
				beneficiaries: this.beneficiaries,
				myPersonId: this.myPersonId
			})
		);
	}

	/** Bloque une écriture hors-ligne (updates = online seulement). */
	private assertOnline() {
		if (!online.current) {
			throw new BackendError('network', 'Action indisponible hors-ligne.');
		}
	}

	/** Rejoue les écritures offline en attente puis recharge (au retour en ligne). */
	async syncPending() {
		if (!online.current || outbox.count === 0) return;
		await outbox.flush();
		await this.load();
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
		// Hors-ligne : la CRÉATION est appliquée en local + mise en file (étape 3b) ;
		// l'ÉDITION reste réservée au online (verrou de version).
		if (!online.current) {
			if (input.expense_id != null) this.assertOnline(); // édition → lève
			this.applyOptimisticCreate({ trip_id: this.tripId, ...input });
			return;
		}
		await this.withConflictReload(() => backend.saveExpense({ trip_id: this.tripId, ...input }));
		await this.load(['expenses', 'beneficiaries']); // soldes = dérivés
	}
	async removeExpense(exp: Expense) {
		// Hors-ligne : suppression appliquée en local + mise en file (ou annulation d'une
		// création encore en attente si la dépense a été créée hors-ligne).
		if (!online.current) {
			if (exp.id.startsWith('local-')) {
				// création jamais synchronisée → collapse : on retire vraiment (rien à envoyer)
				await outbox.cancelPendingCreate(exp.id);
				this.expenses = this.expenses.filter((e) => e.id !== exp.id);
				this.beneficiaries = this.beneficiaries.filter((b) => b.expense_id !== exp.id);
			} else {
				// dépense synchronisée : on la GARDE affichée (médaillon « supprimé · à
				// synchroniser », via pendingDeleteIds) ; elle sort des soldes et disparaîtra
				// vraiment à la synchro.
				await outbox.enqueueDelete(this.tripId, exp.id);
			}
			this.persistSnapshot();
			return;
		}
		await this.withConflictReload(() =>
			backend.deleteExpense({
				trip_id: this.tripId,
				expense_id: exp.id,
				expected_version: exp.version
			})
		);
		await this.load(['expenses', 'beneficiaries']); // soldes = dérivés
	}

	/**
	 * Ajoute une dépense LOCALEMENT (hors-ligne) : split calculé en TS (`previewSplit`,
	 * miroir de `compute_split`), id temporaire `local-…`, état + cache mis à jour, et op
	 * empilée pour la synchro. Les soldes se re-dérivent automatiquement.
	 */
	private applyOptimisticCreate(input: SaveExpenseInput) {
		const tempId = `local-${crypto.randomUUID()}`;
		const pv = previewSplit(input.amount_cents, input.beneficiaries);
		const benefs: Beneficiary[] = input.beneficiaries.map((b) => ({
			expense_id: tempId,
			person_id: b.person_id,
			is_locked: b.is_locked ?? false,
			weight: b.weight ?? null,
			amount_cents: pv.amounts?.[b.person_id] ?? 0
		}));
		const expense: Expense = {
			id: tempId,
			description: input.description?.trim() ?? '',
			category: input.category ?? null,
			amount_cents: input.amount_cents,
			spent_on: input.spent_on || todayISO(),
			paid_by_person_id: input.paid_by_person_id,
			version: 0
		};
		this.expenses = [expense, ...this.expenses];
		this.beneficiaries = [...this.beneficiaries, ...benefs];
		this.persistSnapshot();
		void outbox.enqueueCreate(this.tripId, tempId, input);
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
		this.assertOnline();
		await backend.addParticipant({ trip_id: this.tripId, ...params });
		// un nouveau foyer ajoute une ligne (solde 0) — les soldes sont dérivés des participants
		await this.load(['participants']);
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
		default_weight?: number;
		move_household_id?: string | null;
		new_household_name?: string;
	}) {
		this.assertOnline();
		if (params.person_name != null) {
			await backend.updatePersonName(params.person_id, params.person_name);
		}
		if (params.default_weight != null) {
			await backend.setParticipantDefaultWeight(params.participant_id, params.default_weight);
		}
		if (params.move_household_id !== undefined) {
			await backend.setParticipantHousehold({
				participant_id: params.participant_id,
				household_id: params.move_household_id,
				household_name: params.new_household_name
			});
		}
		// le déplacement de foyer est rétroactif (soldes dérivés par foyer courant)
		await this.load(['participants']);
	}
	/** Renomme un foyer (partagé → visible pour tous ses membres). */
	async renameHousehold(householdId: string, name: string) {
		this.assertOnline();
		await backend.updateHouseholdName(householdId, name);
		await this.load(['participants']);
	}
	/** Marque un participant présent (active=true) ou parti (false). */
	async setActive(participantId: string, active: boolean) {
		this.assertOnline();
		await backend.setParticipantActive(participantId, active);
		// `active` n'entre pas dans le calcul des soldes existants
		await this.load(['participants']);
	}
	/** Réglages du séjour (nom, devise). */
	async updateSettings(patch: { name?: string; currency?: string }) {
		this.assertOnline();
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
