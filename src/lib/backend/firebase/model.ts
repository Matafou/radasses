import { collection, doc } from 'firebase/firestore';
import { db } from './client';
import type { Trip } from '../types';

// Modèle Firestore (voir `firestore.rules`) :
//   trips/{t}                    TripDoc (+ op_seq : dernier n° de journal)
//     households/{id} persons/{id} participants/{id} expenses/{id} members/{uid} ops/{n}
//   inviteTokens/{jeton}         { trip_id, participant_id }
//   joinTokens/{jeton}           { trip_id, candidates: { [participant_id]: Candidate } }
//     claims/{participant_id}    { uid }

export type TripDoc = {
	name: string;
	currency: string;
	created_at: string;
	created_by: string;
	join_token: string;
	op_seq: number;
};
export type NamedDoc = { trip_id: string; name: string; created_at: string };
export type ParticipantDoc = {
	trip_id: string;
	person_id: string;
	household_id: string;
	default_weight: number;
	active: boolean;
	invite_token: string;
	created_at: string;
};
export type StoredBeneficiary = {
	person_id: string;
	is_locked: boolean;
	weight: number | null;
	amount_cents: number;
};
export type ExpenseDoc = {
	trip_id: string;
	description: string;
	category: string | null;
	amount_cents: number;
	spent_on: string;
	paid_by_person_id: string;
	version: number;
	created_by: string;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	beneficiaries: StoredBeneficiary[];
};
export type MemberDoc = {
	uid: string;
	trip_id: string;
	participant_id: string;
	via_invite?: string;
	via_join?: string;
};
export type Candidate = { person_name: string; household_name: string; created_at: string };

export const nowIso = () => new Date().toISOString();
/** Jeton secret (lien à partager) : même forme qu'avant (UUID sans tirets). */
export const newToken = () => crypto.randomUUID().replaceAll('-', '');

export const tripRef = (t: string) => doc(db, 'trips', t);
export const sub = (t: string, coll: string, id: string) => doc(db, 'trips', t, coll, id);
export const subColl = (t: string, coll: string) => collection(db, 'trips', t, coll);
export const inviteRef = (tok: string) => doc(db, 'inviteTokens', tok);
export const joinRef = (tok: string) => doc(db, 'joinTokens', tok);
export const claimRef = (tok: string, pid: string) => doc(db, 'joinTokens', tok, 'claims', pid);

// --- Instantanés « ligne » des entités, au format du journal (identique à l'ancien
// `to_jsonb(row)` Postgres) → `fold.ts` et `undo.ts` n'ont pas à changer. ---
export const tripRow = (id: string, d: TripDoc): Trip & { created_by: string } => ({
	id,
	name: d.name,
	currency: d.currency,
	created_at: d.created_at,
	join_token: d.join_token,
	created_by: d.created_by
});
export const namedRow = (id: string, d: NamedDoc) => ({ id, ...d });
export const participantRow = (id: string, d: ParticipantDoc) => ({ id, ...d });
export function expensePayload(id: string, d: ExpenseDoc) {
	const { beneficiaries, ...rest } = d;
	return {
		expense: { id, ...rest },
		beneficiaries: beneficiaries.map((b) => ({ expense_id: id, trip_id: d.trip_id, ...b }))
	};
}
