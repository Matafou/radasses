import { supabase } from './client';
import { toBackendError } from './errors';
import type { Balance, Beneficiary, Expense, Operation, Participant, Trip } from '../types';

export async function getTrip(tripId: string): Promise<Trip | null> {
	const { data, error } = await supabase
		.from('trips')
		.select('id, name, currency, created_at, join_token')
		.eq('id', tripId)
		.maybeSingle();
	if (error) throw toBackendError(error);
	return data;
}

export async function listParticipants(tripId: string): Promise<Participant[]> {
	const { data, error } = await supabase
		.from('trip_participants')
		.select(
			'id, person_id, household_id, default_weight, active, invite_token, persons(name), households(name)'
		)
		.eq('trip_id', tripId);
	if (error) throw toBackendError(error);
	// persons/households sont des embeds (FK directes) ; numeric revient en string.
	return (data ?? []).map((r) => ({
		participant_id: r.id,
		person_id: r.person_id,
		person_name: r.persons?.name ?? '?',
		household_id: r.household_id,
		household_name: r.households?.name ?? '?',
		default_weight: Number(r.default_weight),
		active: r.active,
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
	if (error) throw toBackendError(error);
	return data ?? [];
}

export async function listBeneficiaries(tripId: string): Promise<Beneficiary[]> {
	const { data, error } = await supabase
		.from('expense_beneficiaries')
		.select('expense_id, person_id, is_locked, weight, amount_cents')
		.eq('trip_id', tripId);
	if (error) throw toBackendError(error);
	// `Number(r.weight)` : PostgREST sérialise `numeric` en STRING pour préserver la
	// précision — le type généré dit `number` (type Postgres réel), le runtime peut
	// renvoyer une string ; conversion défensive conservée malgré le typage.
	return (data ?? []).map((r) => ({
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
	if (error) throw toBackendError(error);
	// Le générateur de types marque toute colonne de VUE comme nullable par défaut
	// (limitation connue, indépendante du schéma réel) : `balances` groupe par
	// `household_id`, colonne NOT NULL sur `trip_participants` → jamais null en
	// pratique. Cast ciblé, pas un `data as Balance[]` générique.
	return (data ?? []) as Balance[];
}

export async function updateTrip(
	tripId: string,
	patch: { name?: string; currency?: string }
): Promise<void> {
	const { error } = await supabase.from('trips').update(patch).eq('id', tripId);
	if (error) throw toBackendError(error);
}

export async function updatePersonName(personId: string, name: string): Promise<void> {
	const { error } = await supabase.from('persons').update({ name }).eq('id', personId);
	if (error) throw toBackendError(error);
}

export async function updateHouseholdName(householdId: string, name: string): Promise<void> {
	const { error } = await supabase.from('households').update({ name }).eq('id', householdId);
	if (error) throw toBackendError(error);
}

export async function setParticipantActive(participantId: string, active: boolean): Promise<void> {
	const { error } = await supabase
		.from('trip_participants')
		.update({ active })
		.eq('id', participantId);
	if (error) throw toBackendError(error);
}

/** Poids par défaut du participant (parts relatives, > 0), appliqué à la demande
 *  dans une dépense en mode détaillé. N'affecte PAS les dépenses déjà saisies
 *  (chacune stocke ses propres poids/montants). */
export async function setParticipantDefaultWeight(
	participantId: string,
	weight: number
): Promise<void> {
	const { error } = await supabase
		.from('trip_participants')
		.update({ default_weight: weight })
		.eq('id', participantId);
	if (error) throw toBackendError(error);
}

/**
 * Déplace un participant vers un autre foyer. `household_id` absent/null =>
 * créer un nouveau foyer (nommé `household_name`, ou « Sans nom » à défaut) pour
 * l'y placer seul. RLS autorise déjà l'`insert households` + l'`update
 * trip_participants.household_id` d'un membre (cf. `setParticipantActive`), donc
 * pas de RPC. NB : les soldes suivent le foyer COURANT (vue `balances` jointe par
 * person_id) → le changement est rétroactif sur tout l'historique du participant.
 * Un ancien foyer laissé vide n'est PAS nettoyé (décision produit).
 */
export async function setParticipantHousehold(params: {
	trip_id: string;
	participant_id: string;
	household_id?: string | null;
	household_name?: string | null;
}): Promise<void> {
	let householdId = params.household_id ?? null;
	if (!householdId) {
		const name = (params.household_name ?? '').trim() || 'Sans nom';
		const { data, error } = await supabase
			.from('households')
			.insert({ name, trip_id: params.trip_id })
			.select('id')
			.single();
		if (error) throw toBackendError(error);
		householdId = data.id;
	}
	const { error } = await supabase
		.from('trip_participants')
		.update({ household_id: householdId })
		.eq('id', params.participant_id);
	if (error) throw toBackendError(error);
}

/** person_id de l'utilisateur courant dans ce séjour (via sa session), ou null. */
export async function getMyPersonId(tripId: string): Promise<string | null> {
	const { data: u } = await supabase.auth.getUser();
	const uid = u.user?.id;
	if (!uid) return null;
	const { data, error } = await supabase
		.from('participant_access')
		.select('trip_participants!inner(trip_id, person_id)')
		.eq('auth_user_id', uid)
		.eq('trip_participants.trip_id', tripId)
		.limit(1);
	if (error) throw toBackendError(error);
	const row = (data ?? [])[0];
	return row?.trip_participants?.person_id ?? null;
}

export async function listOperations(tripId: string): Promise<Operation[]> {
	const { data, error } = await supabase
		.from('operations')
		.select('id, actor_auth_user_id, entity_type, entity_id, action, before, after, created_at')
		.eq('trip_id', tripId)
		.order('id', { ascending: false });
	if (error) throw toBackendError(error);
	return data ?? [];
}

/** Table auth_user_id -> nom de la personne (pour afficher « qui » a agi). */
export async function listActors(tripId: string): Promise<Record<string, string>> {
	const { data, error } = await supabase
		.from('participant_access')
		.select('auth_user_id, trip_participants!inner(trip_id, persons(name))')
		.eq('trip_participants.trip_id', tripId);
	if (error) throw toBackendError(error);
	const map: Record<string, string> = {};
	for (const r of data ?? []) {
		const name = r.trip_participants?.persons?.name;
		if (name) map[r.auth_user_id] = name;
	}
	return map;
}
