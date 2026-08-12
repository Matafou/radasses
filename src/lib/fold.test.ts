import { describe, expect, it } from 'vitest';
import { foldTrip } from './fold';
import type { Operation } from '$lib/backend';

// Vérifie le REPLI du journal (event sourcing) : création trip/person/household/
// participant/expense, renommage (update), dépense créée puis supprimée (tombstone),
// et robustesse à l'ordre d'arrivée (rejeu par `id` croissant).

let seq = 0;
function op(entity_type: string, entity_id: string, action: string, after: unknown): Operation {
	return {
		id: ++seq,
		actor_auth_user_id: null,
		entity_type,
		entity_id,
		action,
		before: null,
		after,
		created_at: '2026-01-01T00:00:00Z'
	};
}

describe('foldTrip', () => {
	it('reconstruit trip + participants (noms) + dépenses depuis le journal', () => {
		const ops: Operation[] = [
			op('trip', 'T', 'create', {
				id: 'T',
				name: 'Été',
				currency: 'EUR',
				created_at: 'c',
				join_token: 'jt'
			}),
			op('household', 'hA', 'create', { id: 'hA', name: 'Alice', trip_id: 'T' }),
			op('person', 'pA', 'create', { id: 'pA', name: 'Alice', trip_id: 'T' }),
			op('participant', 'partA', 'create', {
				id: 'partA',
				trip_id: 'T',
				person_id: 'pA',
				household_id: 'hA',
				default_weight: 1,
				active: true,
				invite_token: 'tokA'
			}),
			op('household', 'hB', 'create', { id: 'hB', name: 'Bob', trip_id: 'T' }),
			op('person', 'pB', 'create', { id: 'pB', name: 'Bob', trip_id: 'T' }),
			op('participant', 'partB', 'create', {
				id: 'partB',
				trip_id: 'T',
				person_id: 'pB',
				household_id: 'hB',
				default_weight: 1,
				active: true,
				invite_token: 'tokB'
			}),
			// dépense « Courses » : 60 € par Alice, 30/30 Alice+Bob
			op('expense', 'e1', 'create', {
				expense: {
					id: 'e1',
					description: 'Courses',
					category: null,
					amount_cents: 6000,
					spent_on: '2026-07-12',
					paid_by_person_id: 'pA',
					version: 1
				},
				beneficiaries: [
					{ expense_id: 'e1', person_id: 'pA', is_locked: false, weight: null, amount_cents: 3000 },
					{ expense_id: 'e1', person_id: 'pB', is_locked: false, weight: null, amount_cents: 3000 }
				]
			}),
			// renommage de Bob -> Bobby (update de person)
			op('person', 'pB', 'update', { id: 'pB', name: 'Bobby', trip_id: 'T' }),
			// dépense « Taxi » créée PUIS supprimée -> ne doit pas apparaître
			op('expense', 'e2', 'create', {
				expense: {
					id: 'e2',
					description: 'Taxi',
					category: null,
					amount_cents: 2000,
					spent_on: '2026-07-13',
					paid_by_person_id: 'pB',
					version: 1
				},
				beneficiaries: [
					{ expense_id: 'e2', person_id: 'pA', is_locked: false, weight: null, amount_cents: 2000 }
				]
			}),
			op('expense', 'e2', 'delete', null)
		];

		const s = foldTrip(ops);

		expect(s.trip).toEqual({
			id: 'T',
			name: 'Été',
			currency: 'EUR',
			created_at: 'c',
			join_token: 'jt'
		});

		expect(s.participants).toHaveLength(2);
		const bob = s.participants.find((p) => p.person_id === 'pB');
		expect(bob?.person_name).toBe('Bobby'); // le renommage (update) est bien replié
		expect(bob?.household_name).toBe('Bob');
		const alice = s.participants.find((p) => p.person_id === 'pA');
		expect(alice?.participant_id).toBe('partA');
		expect(alice?.default_weight).toBe(1);

		// « Taxi » supprimée -> seule « Courses » subsiste
		expect(s.expenses.map((e) => e.description)).toEqual(['Courses']);
		expect(s.beneficiaries).toHaveLength(2);
		expect(s.beneficiaries.every((b) => b.expense_id === 'e1')).toBe(true);
	});

	it("rejoue dans l'ordre `id` même si les événements arrivent mélangés", () => {
		const a = op('trip', 'T', 'create', { id: 'T', name: 'V1', currency: 'EUR', join_token: 'j' });
		const b = op('trip', 'T', 'update', { id: 'T', name: 'V2', currency: 'EUR', join_token: 'j' });
		// on passe [b, a] (désordonnés) -> le fold trie par id -> dernier = V2
		expect(foldTrip([b, a]).trip?.name).toBe('V2');
	});
});
