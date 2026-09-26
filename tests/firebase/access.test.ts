import { describe, expect, it } from 'vitest';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/backend/firebase/client';
import { backend } from '$lib/backend';
import { asNewUser, denied, rejectsWith, tripWithTwo } from './helpers';

// Port de supabase/tests/access.test.sql + garde-fous des règles Firestore.
describe('accès à un séjour', () => {
	it('un membre lit le séjour et enregistre une dépense', async () => {
		const { trip_id, alice, zoe } = await tripWithTwo();
		expect((await backend.getTrip(trip_id))?.name).toBe('Test');
		const r = await backend.saveExpense({
			trip_id,
			amount_cents: 1000,
			paid_by_person_id: alice.person_id,
			beneficiaries: [{ person_id: alice.person_id }, { person_id: zoe.person_id }]
		});
		expect(r.version).toBe(1);
	});

	it('un non-membre ne voit rien et ne peut rien écrire', async () => {
		const { trip_id, alice } = await tripWithTwo();
		const exp = await backend.saveExpense({
			trip_id,
			amount_cents: 1000,
			paid_by_person_id: alice.person_id,
			beneficiaries: [{ person_id: alice.person_id }]
		});
		await asNewUser();
		expect(await backend.getTrip(trip_id)).toBeNull();
		expect(await backend.listParticipants(trip_id)).toEqual([]);
		expect(await backend.listOperations(trip_id)).toEqual([]);
		expect(await backend.getMyPersonId(trip_id)).toBeNull();
		await rejectsWith(
			backend.saveExpense({
				trip_id,
				amount_cents: 1000,
				paid_by_person_id: alice.person_id,
				beneficiaries: [{ person_id: alice.person_id }]
			}),
			'forbidden'
		);
		await rejectsWith(backend.deleteExpense({ trip_id, expense_id: exp.expense_id }), 'forbidden');
		await rejectsWith(backend.updateTrip(trip_id, { name: 'Piraté' }), 'forbidden');
	});

	it("un non-membre ne peut pas s'ajouter sans jeton valide", async () => {
		const a = await tripWithTwo();
		const b = await tripWithTwo(); // autre séjour, dont on connaît les jetons
		const bJoin = (await backend.getTrip(b.trip_id))!.join_token;
		const uid = await asNewUser();
		const member = (via: Record<string, string>) =>
			setDoc(doc(db, 'trips', a.trip_id, 'members', uid), {
				uid,
				trip_id: a.trip_id,
				participant_id: a.alice.participant_id,
				...via
			});
		await denied(member({}));
		// jeton d'invitation d'un AUTRE séjour
		await denied(member({ via_invite: b.zoe.token }));
		// jeton d'invitation de ce séjour mais d'un autre participant
		await denied(member({ via_invite: a.zoe.token }));
		// jeton de séjour (« Qui es-tu ? ») d'un autre séjour
		await denied(member({ via_join: bJoin }));
		expect(await backend.getTrip(a.trip_id)).toBeNull();
	});

	it('un membre ne peut ni supprimer, ni écrire sans journal, ni réécrire le journal', async () => {
		const { trip_id, alice, zoe } = await tripWithTwo();
		const t = (...p: string[]) => doc(db, 'trips', trip_id, ...p);
		await denied(deleteDoc(t('participants', zoe.participant_id)));
		await denied(deleteDoc(t('persons', alice.person_id)));
		// écriture d'entité sans avancer op_seq ni journaliser
		await denied(updateDoc(t('persons', alice.person_id), { name: 'Bob' }));
		// le journal est append-only
		await denied(updateDoc(t('ops', '1'), { action: 'delete' }));
		await denied(deleteDoc(t('ops', '1')));
		// suppression physique d'une dépense
		const exp = await backend.saveExpense({
			trip_id,
			amount_cents: 500,
			paid_by_person_id: alice.person_id,
			beneficiaries: [{ person_id: alice.person_id }]
		});
		await denied(deleteDoc(t('expenses', exp.expense_id)));
		expect((await getDoc(t('persons', alice.person_id))).data()?.name).toBe('Alice');
	});

	it("un participant ne peut pas pointer vers la personne d'un autre séjour", async () => {
		const other = await tripWithTwo();
		const { trip_id, alice } = await tripWithTwo();
		await denied(
			setDoc(doc(db, 'trips', trip_id, 'participants', crypto.randomUUID()), {
				trip_id,
				person_id: other.alice.person_id, // personne d'un autre séjour
				household_id: alice.household_id,
				default_weight: 1,
				active: true,
				invite_token: 'x',
				created_at: new Date().toISOString()
			})
		);
	});
});
