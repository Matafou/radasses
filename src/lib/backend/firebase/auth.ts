import { signInAnonymously } from 'firebase/auth';
import { collection, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from './client';
import { toBackendError, validation } from './errors';
import {
	claimRef,
	inviteRef,
	joinRef,
	sub,
	tripRef,
	type Candidate,
	type MemberDoc,
	type ParticipantDoc,
	type TripDoc
} from './model';
import type { JoinCandidate } from '../types';

/**
 * Garantit qu'une session existe. Si aucune, ouvre une session ANONYME (aucun écran
 * de login, aucun mot de passe). L'identité est conservée par le SDK sur l'appareil ;
 * on la relie à un participant via `redeemToken` / `claimParticipant`. Une session
 * anonyme pourra plus tard être CONVERTIE en compte (email…) sans changer d'uid
 * (`linkWithCredential`).
 */
export async function ensureSession(): Promise<void> {
	try {
		await auth.authStateReady();
		if (!auth.currentUser) await signInAnonymously(auth);
	} catch (e) {
		throw toBackendError(e);
	}
}

/** uid de la session courante (ouvre une session anonyme si besoin). */
export async function requireUid(): Promise<string> {
	await ensureSession();
	return auth.currentUser!.uid;
}

/**
 * Rattache la session à un participant (document `members/{uid}`) et marque l'identité
 * comme réclamée dans l'annuaire du lien de séjour. Idempotent (rejouable sur un autre
 * appareil ; un nouveau choix remplace l'ancien). Les règles vérifient le jeton.
 */
async function join(
	tripId: string,
	participantId: string,
	via: { via_invite: string } | { via_join: string }
): Promise<void> {
	const uid = await requireUid();
	const member: MemberDoc = { uid, trip_id: tripId, participant_id: participantId, ...via };
	await setDoc(sub(tripId, 'members', uid), member);
	// Désormais membre : on peut lire le séjour pour trouver son jeton partageable.
	const trip = (await getDoc(tripRef(tripId))).data() as TripDoc;
	await setDoc(claimRef(trip.join_token, participantId), { uid });
}

/**
 * Rattache la session courante au participant désigné par le jeton d'invitation
 * présent dans l'URL. Renvoie l'id du séjour rejoint.
 */
export async function redeemToken(token: string): Promise<string> {
	try {
		await ensureSession();
		const s = await getDoc(inviteRef(token));
		if (!s.exists()) throw validation('Jeton invalide.');
		const { trip_id, participant_id } = s.data() as { trip_id: string; participant_id: string };
		await join(trip_id, participant_id, { via_invite: token });
		return trip_id;
	} catch (e) {
		throw toBackendError(e);
	}
}

/**
 * Participants d'un séjour pour l'écran « Qui es-tu ? », à partir du jeton de séjour
 * PARTAGEABLE, + drapeau `claimed` (déjà réclamé au moins une fois).
 */
export async function listJoinCandidates(joinToken: string): Promise<JoinCandidate[]> {
	try {
		await ensureSession();
		const s = await getDoc(joinRef(joinToken));
		if (!s.exists()) throw validation('Jeton invalide.');
		const candidates = (s.data().candidates ?? {}) as Record<string, Candidate>;
		const claims = await getDocs(collection(db, 'joinTokens', joinToken, 'claims'));
		const claimed = new Set(claims.docs.map((d) => d.id));
		return Object.entries(candidates)
			.sort(([, a], [, b]) => (a.created_at < b.created_at ? -1 : 1))
			.map(([participant_id, c]) => ({
				participant_id,
				person_name: c.person_name,
				household_name: c.household_name,
				claimed: claimed.has(participant_id)
			}));
	} catch (e) {
		throw toBackendError(e);
	}
}

/**
 * Réclame une identité via le lien de séjour : rattache la session au participant
 * choisi. Idempotent. Renvoie l'id du séjour rejoint.
 */
export async function claimParticipant(joinToken: string, participantId: string): Promise<string> {
	try {
		await ensureSession();
		const s = await getDoc(joinRef(joinToken));
		if (!s.exists()) throw validation('Jeton invalide.');
		const { trip_id, candidates } = s.data() as {
			trip_id: string;
			candidates: Record<string, Candidate>;
		};
		if (!candidates?.[participantId]) throw validation('Participant invalide.');
		await join(trip_id, participantId, { via_join: joinToken });
		return trip_id;
	} catch (e) {
		throw toBackendError(e);
	}
}

/** person_id de l'utilisateur courant dans ce séjour, ou null (non membre). */
export async function getMyPersonId(tripId: string): Promise<string | null> {
	try {
		const uid = await requireUid();
		const m = await getDoc(sub(tripId, 'members', uid));
		if (!m.exists()) return null;
		const p = await getDoc(sub(tripId, 'participants', (m.data() as MemberDoc).participant_id));
		return p.exists() ? (p.data() as ParticipantDoc).person_id : null;
	} catch (e) {
		throw toBackendError(e);
	}
}
