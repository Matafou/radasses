import {
	FieldPath,
	runTransaction,
	type DocumentData,
	type DocumentReference,
	type Transaction
} from 'firebase/firestore';
import { db } from './client';
import { requireUid } from './auth';
import { BackendError } from '../errors';
import { toBackendError } from './errors';
import { joinRef, nowIso, sub, tripRef, type Candidate, type TripDoc } from './model';

export type OpDraft = {
	entity_type: 'trip' | 'person' | 'household' | 'participant' | 'expense';
	entity_id: string;
	action: 'create' | 'update' | 'delete';
	before: unknown;
	after: unknown;
};

export type JournalCtx = {
	tx: Transaction;
	tripId: string;
	trip: TripDoc;
	/** Empile une entrée de journal (écrite à la fin de la transaction). */
	log: (op: OpDraft) => void;
	/** Champs du séjour à modifier en même temps que `op_seq` (renommage…). */
	tripPatch: Partial<Pick<TripDoc, 'name' | 'currency'>>;
};

/** Ce qu'ont en commun `Transaction` et `WriteBatch` pour écrire le journal. */
type Writer = { set(ref: DocumentReference, data: DocumentData): unknown };

/** Écrit les entrées de journal `ops` numérotées à la suite de `fromSeq` ; renvoie le dernier n°. */
export function writeOps(
	tx: Writer,
	tripId: string,
	fromSeq: number,
	ops: OpDraft[],
	uid: string
): number {
	let seq = fromSeq;
	const created_at = nowIso();
	for (const op of ops) {
		seq += 1;
		tx.set(sub(tripId, 'ops', String(seq)), {
			...op,
			id: seq,
			trip_id: tripId,
			actor_auth_user_id: uid,
			created_at
		});
	}
	return seq;
}

/**
 * Mutation JOURNALISÉE d'un séjour existant, dans une transaction Firestore : `fn` lit
 * (via `ctx.tx`) puis écrit, et déclare ses entrées de journal via `ctx.log` ; on ajoute
 * ensuite les `ops/{n}` et on avance `op_seq` atomiquement. Le compteur du séjour
 * sérialise toutes les écritures (ordre total, comme l'`id` identity de Postgres) :
 * deux écritures concurrentes → Firestore rejoue la transaction perdante.
 */
export async function journaled<T>(
	tripId: string,
	fn: (ctx: JournalCtx) => Promise<T> | T
): Promise<T> {
	const uid = await requireUid();
	try {
		return await runTransaction(db, async (tx) => {
			const snap = await tx.get(tripRef(tripId));
			if (!snap.exists()) throw new BackendError('not-found', 'Séjour introuvable.');
			const ops: OpDraft[] = [];
			const ctx: JournalCtx = {
				tx,
				tripId,
				trip: snap.data() as TripDoc,
				log: (op) => ops.push(op),
				tripPatch: {}
			};
			const result = await fn(ctx);
			if (!ops.length) return result;
			const seq = writeOps(tx, tripId, ctx.trip.op_seq, ops, uid);
			tx.update(tripRef(tripId), { ...ctx.tripPatch, op_seq: seq });
			return result;
		});
	} catch (e) {
		throw toBackendError(e);
	}
}

/**
 * Met à jour des champs de l'annuaire « Qui es-tu ? » (`joinTokens/{jeton}.candidates`),
 * dénormalisé pour les non-membres. À appeler dans la même transaction que la
 * modification du participant / de la personne / du foyer concerné.
 */
export function updateCandidate(
	tx: Transaction,
	trip: TripDoc,
	participantId: string,
	patch: Partial<Candidate>
) {
	const entries = Object.entries(patch);
	if (!entries.length) return;
	const [[k0, v0], ...more] = entries;
	tx.update(
		joinRef(trip.join_token),
		new FieldPath('candidates', participantId, k0),
		v0,
		...more.flatMap(([k, v]) => [new FieldPath('candidates', participantId, k), v])
	);
}

/** Lit un document dans la transaction ; `null` s'il n'existe pas. */
export async function txGet<T>(tx: Transaction, ref: DocumentReference): Promise<T | null> {
	const s = await tx.get(ref);
	return s.exists() ? (s.data() as T) : null;
}
