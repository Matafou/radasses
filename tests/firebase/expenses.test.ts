import { describe, expect, it } from 'vitest';
import { backend } from '$lib/backend';
import { rejectsWith, tripWithTwo } from './helpers';

// Port de supabase/tests/expenses.test.sql (+ idempotence du rejeu outbox).
describe('dépenses', () => {
	it('soldes par foyer', async () => {
		const { trip_id, alice, zoe } = await tripWithTwo();
		const both = [{ person_id: alice.person_id }, { person_id: zoe.person_id }];
		await backend.saveExpense({
			trip_id,
			amount_cents: 6000,
			paid_by_person_id: alice.person_id,
			beneficiaries: both
		});
		await backend.saveExpense({
			trip_id,
			amount_cents: 1001,
			paid_by_person_id: zoe.person_id,
			beneficiaries: both
		});
		const balances = await backend.getBalances(trip_id);
		const net = (hid: string) => balances.find((b) => b.household_id === hid)!.net_cents;
		// Alice : +6000 − 3000 − 501 (plus grand reste départagé par person_id) ou −500
		expect(net(alice.household_id) + net(zoe.household_id)).toBe(0);
		expect(Math.abs(net(alice.household_id))).toBeGreaterThanOrEqual(2499);
	});

	it('verrou de version sur la modification et la suppression', async () => {
		const { trip_id, alice } = await tripWithTwo();
		const input = {
			trip_id,
			amount_cents: 1000,
			paid_by_person_id: alice.person_id,
			beneficiaries: [{ person_id: alice.person_id }]
		};
		const { expense_id } = await backend.saveExpense(input);
		await rejectsWith(
			backend.saveExpense({ ...input, expense_id, expected_version: 7 }),
			'conflict'
		);
		const v2 = await backend.saveExpense({
			...input,
			expense_id,
			expected_version: 1,
			amount_cents: 2000
		});
		expect(v2.version).toBe(2);
		await rejectsWith(
			backend.deleteExpense({ trip_id, expense_id, expected_version: 1 }),
			'conflict'
		);
		expect(await backend.deleteExpense({ trip_id, expense_id, expected_version: 2 })).toEqual({
			expense_id,
			deleted: true
		});
		await rejectsWith(backend.deleteExpense({ trip_id, expense_id }), 'validation');
		expect(await backend.listExpenses(trip_id)).toEqual([]);

		const ops = await backend.listOperations(trip_id);
		const del = ops.filter((o) => o.entity_type === 'expense' && o.action === 'delete');
		expect(del).toHaveLength(1);
		expect(del[0].before).not.toBeNull();
	});

	it('répartition invalide rejetée', async () => {
		const { trip_id, alice } = await tripWithTwo();
		await rejectsWith(
			backend.saveExpense({
				trip_id,
				amount_cents: 1000,
				paid_by_person_id: alice.person_id,
				beneficiaries: [{ person_id: alice.person_id, is_locked: true, amount_cents: 1000 }]
			}),
			'validation'
		);
	});

	it('rejeu d’une création hors-ligne (client_id) : pas de doublon', async () => {
		const { trip_id, alice } = await tripWithTwo();
		const input = {
			trip_id,
			client_id: crypto.randomUUID(),
			amount_cents: 1000,
			paid_by_person_id: alice.person_id,
			beneficiaries: [{ person_id: alice.person_id }]
		};
		const a = await backend.saveExpense(input);
		const b = await backend.saveExpense(input);
		expect(b.expense_id).toBe(a.expense_id);
		expect(a.expense_id).toBe(input.client_id);
		expect(await backend.listExpenses(trip_id)).toHaveLength(1);
	});
});
