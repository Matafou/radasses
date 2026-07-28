import { getContext, setContext } from 'svelte';
import {
	getTrip, listParticipants, listExpenses, listBeneficiaries, getBalances, listSettlements,
	updatePersonName, updateHouseholdName,
	type Trip, type Participant, type Expense, type Beneficiary, type Balance, type Settlement
} from './db';
import { saveExpense, deleteExpense, type SaveExpenseInput } from './expenses';
import { addParticipant } from './auth';
import { simplifyDebts, recordSettlement, cancelSettlement, type Transfer } from './settlements';

/**
 * État partagé d'un séjour : chargé une fois par le layout /t/[tripId] et
 * consommé par les onglets (Dépenses, Soldes, Participants) via le contexte.
 * Les mutations rechargent l'ensemble.
 */
export class TripState {
	tripId = $state('');
	loading = $state(true);
	error = $state<string | null>(null);
	trip = $state<Trip | null>(null);
	participants = $state<Participant[]>([]);
	expenses = $state<Expense[]>([]);
	beneficiaries = $state<Beneficiary[]>([]);
	balances = $state<Balance[]>([]);
	settlements = $state<Settlement[]>([]);

	personName = $derived(new Map(this.participants.map((p) => [p.person_id, p.person_name])));
	householdName = $derived(new Map(this.participants.map((p) => [p.household_id, p.household_name])));
	households = $derived(Array.from(this.householdName, ([id, name]) => ({ id, name })));
	transfers = $derived(simplifyDebts(this.balances));
	benefByExpense = $derived.by(() => {
		const m = new Map<string, Beneficiary[]>();
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

	async load() {
		const id = this.tripId;
		if (!id) return;
		this.loading = true;
		this.error = null;
		try {
			const [trip, participants, expenses, beneficiaries, balances, settlements] = await Promise.all([
				getTrip(id), listParticipants(id), listExpenses(id), listBeneficiaries(id),
				getBalances(id), listSettlements(id)
			]);
			this.trip = trip;
			this.participants = participants;
			this.expenses = expenses;
			this.beneficiaries = beneficiaries;
			this.balances = balances;
			this.settlements = settlements;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.loading = false;
		}
	}

	/** Crée (sans expense_id) ou met à jour (avec expense_id + expected_version). */
	async upsertExpense(input: Omit<SaveExpenseInput, 'trip_id'>) {
		await saveExpense({ trip_id: this.tripId, ...input });
		await this.load();
	}
	async removeExpense(exp: Expense) {
		await deleteExpense({ trip_id: this.tripId, expense_id: exp.id, expected_version: exp.version });
		await this.load();
	}
	async newParticipant(params: { person_name: string; household_id?: string | null }) {
		await addParticipant({ trip_id: this.tripId, ...params });
		await this.load();
	}
	/** Renomme la personne et son foyer (le foyer est partagé -> renommé pour tous ses membres). */
	async renameParticipant(params: {
		person_id: string;
		person_name: string;
		household_id: string;
		household_name: string;
	}) {
		await updatePersonName(params.person_id, params.person_name);
		await updateHouseholdName(params.household_id, params.household_name);
		await this.load();
	}
	async settle(t: Transfer) {
		await recordSettlement({ trip_id: this.tripId, ...t });
		await this.load();
	}
	async unsettle(s: Settlement) {
		await cancelSettlement(s.id);
		await this.load();
	}
}

const KEY = Symbol('trip');
export function setTripState(s: TripState) {
	setContext(KEY, s);
}
export function getTripState(): TripState {
	return getContext(KEY) as TripState;
}
