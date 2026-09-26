import { signOut } from 'firebase/auth';
import { expect } from 'vitest';
import { auth } from '$lib/backend/firebase/client';
import { backend, BackendError, type BackendErrorCode } from '$lib/backend';

/** Change d'identité : nouvelle session anonyme (nouvel uid), comme un autre appareil. */
export async function asNewUser(): Promise<string> {
	await signOut(auth);
	await backend.ensureSession();
	return auth.currentUser!.uid;
}

/** Séjour « Dupont » (Alice, moi) + Zoé dans un 2ᵉ foyer. L'utilisateur courant en est membre. */
export async function tripWithTwo() {
	await asNewUser();
	const created = await backend.createTrip({
		name: 'Test',
		myName: 'Alice',
		myHouseholdName: 'Dupont'
	});
	const trip_id = created.trip_id;
	const zoe = await backend.addParticipant({ trip_id, person_name: 'Zoé' });
	const ps = await backend.listParticipants(trip_id);
	const alice = ps.find((p) => p.person_name === 'Alice')!;
	return { trip_id, created, alice, zoe };
}

/** La promesse échoue avec une `BackendError` de ce code. */
export async function rejectsWith(p: Promise<unknown>, code: BackendErrorCode) {
	const e = await p.then(
		() => null,
		(err) => err
	);
	expect(e, `une erreur « ${code} » est attendue`).toBeInstanceOf(BackendError);
	expect((e as BackendError).code).toBe(code);
}

/** Écriture Firestore brute (contournant l'adaptateur) : doit être refusée par les règles. */
export async function denied(p: Promise<unknown>) {
	const e = await p.then(
		() => null,
		(err) => err
	);
	expect(e, 'écriture refusée attendue').not.toBeNull();
	expect((e as { code?: string }).code).toBe('permission-denied');
}
