import {
	FieldPath,
	getDoc,
	getDocs,
	orderBy,
	query,
	where,
	writeBatch,
	type QueryDocumentSnapshot
} from 'firebase/firestore';
import { computeBalances } from '$lib/balances';
import { db } from './client';
import { requireUid } from './auth';
import { toBackendError, validation } from './errors';
import { journaled, txGet, updateCandidate, writeOps } from './journal';
import {
	inviteRef,
	joinRef,
	claimRef,
	namedRow,
	newToken,
	nowIso,
	participantRow,
	sub,
	subColl,
	tripRef,
	tripRow,
	type Candidate,
	type ExpenseDoc,
	type MemberDoc,
	type NamedDoc,
	type ParticipantDoc,
	type TripDoc
} from './model';
import { BackendError } from '../errors';
import type { Balance, Beneficiary, Expense, Operation, Participant, Trip } from '../types';

/**
 * Lecture d'un séjour dont on n'est pas membre → les règles refusent. Comme les RLS
 * d'avant (qui FILTRAIENT les lignes), on renvoie alors un résultat vide.
 */
async function readOr<T>(fallback: T, read: () => Promise<T>): Promise<T> {
	try {
		return await read();
	} catch (e) {
		const err = toBackendError(e);
		if (err.code === 'forbidden') return fallback;
		throw err;
	}
}

const docsOf = <T>(snaps: QueryDocumentSnapshot[]) =>
	snaps.map((s) => ({ id: s.id, ...(s.data() as T) }));

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

/**
 * Crée un nouveau séjour + le premier participant (moi), en UN lot atomique (séjour,
 * foyer, personne, participant, adhésion, jetons, journal). Renvoie
 * { trip_id, participant_id, token } — `token` = lien à partager pour ce participant.
 */
export async function createTrip(params: {
	name: string;
	currency?: string;
	myName: string;
	myHouseholdName?: string;
}): Promise<{ trip_id: string; participant_id: string; token: string }> {
	try {
		const uid = await requireUid();
		const now = nowIso();
		const [t, h, p, pid] = [0, 0, 0, 0].map(() => crypto.randomUUID());
		const token = newToken();
		const trip: TripDoc = {
			name: params.name,
			currency: params.currency || 'EUR',
			created_at: now,
			created_by: uid,
			join_token: newToken(),
			op_seq: 4
		};
		const household: NamedDoc = {
			trip_id: t,
			name: params.myHouseholdName?.trim() || params.myName,
			created_at: now
		};
		const person: NamedDoc = { trip_id: t, name: params.myName, created_at: now };
		const participant: ParticipantDoc = {
			trip_id: t,
			person_id: p,
			household_id: h,
			default_weight: 1,
			active: true,
			invite_token: token,
			created_at: now
		};
		const candidate: Candidate = {
			person_name: person.name,
			household_name: household.name,
			created_at: now
		};

		const b = writeBatch(db);
		b.set(tripRef(t), trip);
		b.set(sub(t, 'households', h), household);
		b.set(sub(t, 'persons', p), person);
		b.set(sub(t, 'participants', pid), participant);
		b.set(sub(t, 'members', uid), { uid, trip_id: t, participant_id: pid } satisfies MemberDoc);
		b.set(inviteRef(token), { trip_id: t, participant_id: pid });
		b.set(joinRef(trip.join_token), { trip_id: t, candidates: { [pid]: candidate } });
		b.set(claimRef(trip.join_token, pid), { uid });
		writeOps(
			b,
			t,
			0,
			[
				{
					entity_type: 'trip',
					entity_id: t,
					action: 'create',
					before: null,
					after: tripRow(t, trip)
				},
				{
					entity_type: 'household',
					entity_id: h,
					action: 'create',
					before: null,
					after: namedRow(h, household)
				},
				{
					entity_type: 'person',
					entity_id: p,
					action: 'create',
					before: null,
					after: namedRow(p, person)
				},
				{
					entity_type: 'participant',
					entity_id: pid,
					action: 'create',
					before: null,
					after: participantRow(pid, participant)
				}
			],
			uid
		);
		await b.commit();
		return { trip_id: t, participant_id: pid, token };
	} catch (e) {
		throw toBackendError(e);
	}
}

/**
 * Ajoute un participant : nouveau foyer, ou foyer existant si `household_id` est
 * fourni. Renvoie le jeton (lien à partager).
 */
export async function addParticipant(params: {
	trip_id: string;
	person_name: string;
	household_name?: string | null;
	household_id?: string | null;
	default_weight?: number;
}): Promise<{ participant_id: string; person_id: string; household_id: string; token: string }> {
	const t = params.trip_id;
	const name = params.person_name.trim();
	if (!name) throw validation('Nom de la personne requis.');
	return journaled(t, async ({ tx, trip, log }) => {
		const now = nowIso();
		let h = params.household_id ?? null;
		let householdName: string;
		if (h) {
			const existing = await txGet<NamedDoc>(tx, sub(t, 'households', h));
			if (!existing) throw validation('Foyer inconnu pour ce séjour.');
			householdName = existing.name;
		} else {
			h = crypto.randomUUID();
			const household: NamedDoc = {
				trip_id: t,
				name: params.household_name?.trim() || name,
				created_at: now
			};
			householdName = household.name;
			tx.set(sub(t, 'households', h), household);
			log({
				entity_type: 'household',
				entity_id: h,
				action: 'create',
				before: null,
				after: namedRow(h, household)
			});
		}
		const p = crypto.randomUUID();
		const person: NamedDoc = { trip_id: t, name, created_at: now };
		tx.set(sub(t, 'persons', p), person);
		log({
			entity_type: 'person',
			entity_id: p,
			action: 'create',
			before: null,
			after: namedRow(p, person)
		});

		const pid = crypto.randomUUID();
		const token = newToken();
		const participant: ParticipantDoc = {
			trip_id: t,
			person_id: p,
			household_id: h,
			default_weight: params.default_weight ?? 1,
			active: true,
			invite_token: token,
			created_at: now
		};
		tx.set(sub(t, 'participants', pid), participant);
		log({
			entity_type: 'participant',
			entity_id: pid,
			action: 'create',
			before: null,
			after: participantRow(pid, participant)
		});
		tx.set(inviteRef(token), { trip_id: t, participant_id: pid });
		tx.update(joinRef(trip.join_token), new FieldPath('candidates', pid), {
			person_name: name,
			household_name: householdName,
			created_at: now
		} satisfies Candidate);
		return { participant_id: pid, person_id: p, household_id: h, token };
	});
}

// ---------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------

export async function getTrip(tripId: string): Promise<Trip | null> {
	return readOr(null, async () => {
		const s = await getDoc(tripRef(tripId));
		if (!s.exists()) return null;
		const { id, name, currency, created_at, join_token } = tripRow(s.id, s.data() as TripDoc);
		return { id, name, currency, created_at, join_token };
	});
}

export async function listParticipants(tripId: string): Promise<Participant[]> {
	return readOr([], async () => {
		const [ps, persons, households] = await Promise.all(
			['participants', 'persons', 'households'].map((c) => getDocs(subColl(tripId, c)))
		);
		const personName = new Map(persons.docs.map((d) => [d.id, (d.data() as NamedDoc).name]));
		const householdName = new Map(households.docs.map((d) => [d.id, (d.data() as NamedDoc).name]));
		return docsOf<ParticipantDoc>(ps.docs)
			.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
			.map((r) => ({
				participant_id: r.id,
				person_id: r.person_id,
				person_name: personName.get(r.person_id) ?? '?',
				household_id: r.household_id,
				household_name: householdName.get(r.household_id) ?? '?',
				default_weight: Number(r.default_weight),
				active: r.active,
				invite_token: r.invite_token
			}));
	});
}

/**
 * Lectures de dépenses EN COURS, par séjour. `listExpenses` et `listBeneficiaries`
 * lisent la même collection (les bénéficiaires sont embarqués dans les dépenses) et
 * sont appelées ensemble (`Promise.all` du chargement, `getBalances`) : elles
 * partagent une seule lecture, ce qui divise par deux les lectures facturées par
 * Firestore (quota gratuit : 50 000 documents lus / jour). Le partage ne vaut que
 * pour les appels lancés dans le MÊME tour synchrone (entrée retirée en microtâche) :
 * un rechargement ultérieur, après une mutation, relit toujours le serveur.
 */
const inflightExpenses = new Map<string, Promise<(ExpenseDoc & { id: string })[]>>();

/** Dépenses NON supprimées du séjour (bénéficiaires inclus), plus récentes d'abord. */
function liveExpenses(tripId: string) {
	let p = inflightExpenses.get(tripId);
	if (!p) {
		p = getDocs(subColl(tripId, 'expenses')).then((s) =>
			docsOf<ExpenseDoc>(s.docs)
				.filter((e) => e.deleted_at == null)
				.sort((a, b) =>
					a.spent_on === b.spent_on
						? a.created_at < b.created_at
							? 1
							: -1
						: a.spent_on < b.spent_on
							? 1
							: -1
				)
		);
		inflightExpenses.set(tripId, p);
		queueMicrotask(() => inflightExpenses.delete(tripId));
	}
	return p;
}

export async function listExpenses(tripId: string): Promise<Expense[]> {
	return readOr([], async () =>
		(await liveExpenses(tripId)).map((e) => ({
			id: e.id,
			description: e.description,
			category: e.category,
			amount_cents: e.amount_cents,
			spent_on: e.spent_on,
			paid_by_person_id: e.paid_by_person_id,
			version: e.version
		}))
	);
}

export async function listBeneficiaries(tripId: string): Promise<Beneficiary[]> {
	return readOr([], async () =>
		(await liveExpenses(tripId)).flatMap((e) =>
			e.beneficiaries.map((b) => ({
				expense_id: e.id,
				person_id: b.person_id,
				is_locked: b.is_locked,
				weight: b.weight,
				amount_cents: b.amount_cents
			}))
		)
	);
}

/** Soldes par foyer : calculés côté client (plus de vue SQL). */
export async function getBalances(tripId: string): Promise<Balance[]> {
	const [participants, expenses, beneficiaries] = await Promise.all([
		listParticipants(tripId),
		listExpenses(tripId),
		listBeneficiaries(tripId)
	]);
	return computeBalances(participants, expenses, beneficiaries);
}

export async function listOperations(tripId: string): Promise<Operation[]> {
	return readOr([], async () => {
		const s = await getDocs(query(subColl(tripId, 'ops'), orderBy('id', 'desc')));
		return s.docs.map((d) => {
			const o = d.data();
			return {
				id: o.id,
				actor_auth_user_id: o.actor_auth_user_id ?? null,
				entity_type: o.entity_type,
				entity_id: o.entity_id ?? null,
				action: o.action,
				before: o.before ?? null,
				after: o.after ?? null,
				created_at: o.created_at
			};
		});
	});
}

/** Table uid → nom de la personne (pour afficher « qui » a agi dans le journal). */
export async function listActors(tripId: string): Promise<Record<string, string>> {
	return readOr({}, async () => {
		const [members, participants] = await Promise.all([
			getDocs(subColl(tripId, 'members')),
			listParticipants(tripId)
		]);
		const nameOf = new Map(participants.map((p) => [p.participant_id, p.person_name]));
		const map: Record<string, string> = {};
		for (const m of members.docs) {
			const name = nameOf.get((m.data() as MemberDoc).participant_id);
			if (name) map[m.id] = name;
		}
		return map;
	});
}

// ---------------------------------------------------------------------------
// Mutations directes (journalisées)
// ---------------------------------------------------------------------------

export async function updateTrip(
	tripId: string,
	patch: { name?: string; currency?: string }
): Promise<void> {
	await journaled(tripId, (ctx) => {
		const next = { ...ctx.trip, ...patch };
		ctx.tripPatch = patch;
		ctx.log({
			entity_type: 'trip',
			entity_id: tripId,
			action: 'update',
			before: tripRow(tripId, ctx.trip),
			after: tripRow(tripId, next)
		});
	});
}

/** Participants rattachés à une personne / un foyer (pour l'annuaire « Qui es-tu ? »). */
async function participantIdsWhere(tripId: string, field: string, value: string) {
	const s = await getDocs(query(subColl(tripId, 'participants'), where(field, '==', value)));
	return s.docs.map((d) => d.id);
}

async function rename(
	tripId: string,
	coll: 'persons' | 'households',
	id: string,
	name: string
): Promise<void> {
	const field = coll === 'persons' ? 'person_id' : 'household_id';
	const pids = await participantIdsWhere(tripId, field, id).catch((e) => {
		throw toBackendError(e);
	});
	await journaled(tripId, async ({ tx, trip, log }) => {
		const before = await txGet<NamedDoc>(tx, sub(tripId, coll, id));
		if (!before) throw new BackendError('not-found', 'Introuvable dans ce séjour.');
		const after = { ...before, name };
		tx.update(sub(tripId, coll, id), { name });
		log({
			entity_type: coll === 'persons' ? 'person' : 'household',
			entity_id: id,
			action: 'update',
			before: namedRow(id, before),
			after: namedRow(id, after)
		});
		for (const pid of pids)
			updateCandidate(
				tx,
				trip,
				pid,
				coll === 'persons' ? { person_name: name } : { household_name: name }
			);
	});
}

export const updatePersonName = (tripId: string, personId: string, name: string) =>
	rename(tripId, 'persons', personId, name);

export const updateHouseholdName = (tripId: string, householdId: string, name: string) =>
	rename(tripId, 'households', householdId, name);

/** Modifie un participant (journalisé). */
async function patchParticipant(
	tripId: string,
	participantId: string,
	patch: Partial<ParticipantDoc>
): Promise<void> {
	await journaled(tripId, async ({ tx, log }) => {
		const before = await txGet<ParticipantDoc>(tx, sub(tripId, 'participants', participantId));
		if (!before) throw new BackendError('not-found', 'Participant introuvable dans ce séjour.');
		tx.update(sub(tripId, 'participants', participantId), patch);
		log({
			entity_type: 'participant',
			entity_id: participantId,
			action: 'update',
			before: participantRow(participantId, before),
			after: participantRow(participantId, { ...before, ...patch })
		});
	});
}

export const setParticipantActive = (tripId: string, participantId: string, active: boolean) =>
	patchParticipant(tripId, participantId, { active });

/** Poids par défaut du participant (parts relatives, > 0), appliqué à la demande
 *  dans une dépense en mode détaillé. N'affecte PAS les dépenses déjà saisies. */
export const setParticipantDefaultWeight = (
	tripId: string,
	participantId: string,
	weight: number
) => patchParticipant(tripId, participantId, { default_weight: weight });

/**
 * Déplace un participant vers un autre foyer. `household_id` absent/null => créer un
 * nouveau foyer (nommé `household_name`, ou « Sans nom ») pour l'y placer seul. Les
 * soldes suivent le foyer COURANT → changement rétroactif sur tout l'historique. Un
 * ancien foyer laissé vide n'est PAS nettoyé (décision produit).
 */
export async function setParticipantHousehold(params: {
	trip_id: string;
	participant_id: string;
	household_id?: string | null;
	household_name?: string | null;
}): Promise<void> {
	const t = params.trip_id;
	const pid = params.participant_id;
	await journaled(t, async ({ tx, trip, log }) => {
		const before = await txGet<ParticipantDoc>(tx, sub(t, 'participants', pid));
		if (!before) throw new BackendError('not-found', 'Participant introuvable dans ce séjour.');
		let h = params.household_id ?? null;
		let householdName: string;
		if (h) {
			const existing = await txGet<NamedDoc>(tx, sub(t, 'households', h));
			if (!existing) throw validation('Foyer inconnu pour ce séjour.');
			householdName = existing.name;
		} else {
			h = crypto.randomUUID();
			const household: NamedDoc = {
				trip_id: t,
				name: (params.household_name ?? '').trim() || 'Sans nom',
				created_at: nowIso()
			};
			householdName = household.name;
			tx.set(sub(t, 'households', h), household);
			log({
				entity_type: 'household',
				entity_id: h,
				action: 'create',
				before: null,
				after: namedRow(h, household)
			});
		}
		tx.update(sub(t, 'participants', pid), { household_id: h });
		log({
			entity_type: 'participant',
			entity_id: pid,
			action: 'update',
			before: participantRow(pid, before),
			after: participantRow(pid, { ...before, household_id: h })
		});
		updateCandidate(tx, trip, pid, { household_name: householdName });
	});
}
