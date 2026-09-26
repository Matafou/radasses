import { describe, expect, it } from 'vitest';
import { backend } from '$lib/backend';
import { auth } from '$lib/backend/firebase/client';
import { foldTrip } from '$lib/fold';
import { tripWithTwo } from './helpers';

// Port de supabase/tests/journal.test.sql : TOUT est journalisé, dans un ordre total,
// et le repli du journal redonne exactement l'état des collections.
describe('journal', () => {
	it('le fold du journal == état lu', async () => {
		const { trip_id, alice, zoe } = await tripWithTwo();
		const both = [{ person_id: alice.person_id }, { person_id: zoe.person_id }];
		const e1 = await backend.saveExpense({
			trip_id,
			amount_cents: 999,
			paid_by_person_id: alice.person_id,
			beneficiaries: both
		});
		await backend.saveExpense({
			trip_id,
			amount_cents: 500,
			paid_by_person_id: zoe.person_id,
			beneficiaries: both
		});
		await backend.saveExpense({
			trip_id,
			expense_id: e1.expense_id,
			expected_version: 1,
			amount_cents: 1200,
			paid_by_person_id: alice.person_id,
			beneficiaries: [
				{ person_id: alice.person_id, weight: 2 },
				{ person_id: zoe.person_id, weight: 1 }
			]
		});
		await backend.updateTrip(trip_id, { name: 'Renommé', currency: 'CHF' });
		await backend.updatePersonName(trip_id, zoe.person_id, 'Zoë');
		await backend.updateHouseholdName(trip_id, alice.household_id, 'Famille');
		await backend.setParticipantActive(trip_id, zoe.participant_id, false);
		await backend.setParticipantDefaultWeight(trip_id, zoe.participant_id, 0.5);
		await backend.setParticipantHousehold({
			trip_id,
			participant_id: zoe.participant_id,
			household_id: alice.household_id
		});
		await backend.setParticipantHousehold({
			trip_id,
			participant_id: zoe.participant_id,
			household_name: 'Seule'
		});
		await backend.deleteExpense({ trip_id, expense_id: e1.expense_id });

		const ops = await backend.listOperations(trip_id);
		// ordre total, sans trou : 1..n, du plus récent au plus ancien
		expect(ops.map((o) => o.id)).toEqual(ops.map((_, i) => ops.length - i));
		expect(ops.every((o) => o.actor_auth_user_id === auth.currentUser!.uid)).toBe(true);
		expect(new Set(ops.map((o) => o.entity_type))).toEqual(
			new Set(['trip', 'household', 'person', 'participant', 'expense'])
		);

		const folded = foldTrip(ops);
		const [trip, participants, expenses, beneficiaries] = await Promise.all([
			backend.getTrip(trip_id),
			backend.listParticipants(trip_id),
			backend.listExpenses(trip_id),
			backend.listBeneficiaries(trip_id)
		]);
		const by = <T>(a: T[], k: (x: T) => string) => [...a].sort((x, y) => (k(x) < k(y) ? -1 : 1));
		expect(folded.trip).toMatchObject(trip!);
		expect(by(folded.participants, (p) => p.participant_id)).toEqual(
			by(participants, (p) => p.participant_id)
		);
		expect(by(folded.expenses, (e) => e.id)).toEqual(by(expenses, (e) => e.id));
		expect(by(folded.beneficiaries, (b) => b.expense_id + b.person_id)).toEqual(
			by(beneficiaries, (b) => b.expense_id + b.person_id)
		);

		expect(await backend.listActors(trip_id)).toEqual({ [auth.currentUser!.uid]: 'Alice' });
	});
});
