import { supabase } from './supabase';

export type Trip = { id: string; name: string; currency: string; created_at: string };

export type Participant = {
	participant_id: string;
	person_id: string;
	person_name: string;
	household_id: string;
	household_name: string;
	default_weight: number;
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

export async function getTrip(tripId: string): Promise<Trip | null> {
	const { data, error } = await supabase
		.from('trips')
		.select('id, name, currency, created_at')
		.eq('id', tripId)
		.maybeSingle();
	if (error) throw error;
	return data as Trip | null;
}

export async function listParticipants(tripId: string): Promise<Participant[]> {
	const { data, error } = await supabase
		.from('trip_participants')
		.select('id, person_id, household_id, default_weight, invite_token, persons(name), households(name)')
		.eq('trip_id', tripId);
	if (error) throw error;
	// persons/households sont des embeds (FK directes) ; numeric revient en string.
	return (data ?? []).map((r: any) => ({
		participant_id: r.id,
		person_id: r.person_id,
		person_name: r.persons?.name ?? '?',
		household_id: r.household_id,
		household_name: r.households?.name ?? '?',
		default_weight: Number(r.default_weight),
		invite_token: r.invite_token
	}));
}

export async function listExpenses(tripId: string): Promise<Expense[]> {
	const { data, error } = await supabase
		.from('expenses')
		.select('id, description, category, amount_cents, spent_on, paid_by_person_id, version')
		.eq('trip_id', tripId)
		.is('deleted_at', null)
		.order('spent_on', { ascending: false });
	if (error) throw error;
	return (data ?? []) as Expense[];
}

export async function listBeneficiaries(tripId: string): Promise<Beneficiary[]> {
	const { data, error } = await supabase
		.from('expense_beneficiaries')
		.select('expense_id, person_id, is_locked, weight, amount_cents')
		.eq('trip_id', tripId);
	if (error) throw error;
	return (data ?? []).map((r: any) => ({
		expense_id: r.expense_id,
		person_id: r.person_id,
		is_locked: r.is_locked,
		weight: r.weight == null ? null : Number(r.weight),
		amount_cents: r.amount_cents
	}));
}

export async function getBalances(tripId: string): Promise<Balance[]> {
	const { data, error } = await supabase
		.from('balances')
		.select('household_id, net_cents')
		.eq('trip_id', tripId);
	if (error) throw error;
	return (data ?? []) as Balance[];
}

export async function updatePersonName(personId: string, name: string): Promise<void> {
	const { error } = await supabase.from('persons').update({ name }).eq('id', personId);
	if (error) throw error;
}

export async function updateHouseholdName(householdId: string, name: string): Promise<void> {
	const { error } = await supabase.from('households').update({ name }).eq('id', householdId);
	if (error) throw error;
}

export async function listSettlements(tripId: string): Promise<Settlement[]> {
	const { data, error } = await supabase
		.from('settlements')
		.select('id, from_household_id, to_household_id, amount_cents, settled_on')
		.eq('trip_id', tripId)
		.is('deleted_at', null)
		.order('settled_on', { ascending: false });
	if (error) throw error;
	return (data ?? []) as Settlement[];
}
