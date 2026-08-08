import { describe, expect, it } from 'vitest';
import { computeBalances } from './balances';
import type { Participant, Expense, Beneficiary, Balance } from '$lib/backend';

// Réplique TS de la vue SQL `balances` (payé − dû par foyer). On vérifie ici les
// invariants de la vue : un foyer par household_id distinct (même sans dépense),
// tous les participants comptent (actifs ET inactifs), dépenses supprimées exclues.

const P = (person_id: string, household_id: string, active = true): Participant => ({
	participant_id: `part-${person_id}`,
	person_id,
	person_name: person_id,
	household_id,
	household_name: household_id,
	default_weight: 1,
	active,
	invite_token: 'tok'
});

const E = (id: string, paid_by_person_id: string, amount_cents: number): Expense => ({
	id,
	description: id,
	category: null,
	amount_cents,
	spent_on: '2026-01-01',
	paid_by_person_id,
	version: 1
});

const B = (expense_id: string, person_id: string, amount_cents: number): Beneficiary => ({
	expense_id,
	person_id,
	is_locked: false,
	weight: null,
	amount_cents
});

const net = (bals: Balance[], hh: string) => bals.find((b) => b.household_id === hh)?.net_cents;

describe('computeBalances', () => {
	it('cas simple + foyer sans dépense (net 0)', () => {
		const participants = [P('alice', 'hA'), P('bob', 'hB'), P('chloe', 'hC')];
		const expenses = [E('e1', 'alice', 6000)];
		const beneficiaries = [B('e1', 'alice', 3000), B('e1', 'bob', 3000)];

		const bals = computeBalances(participants, expenses, beneficiaries);
		expect(bals).toHaveLength(3); // un foyer par household_id distinct, même hC sans dépense
		expect(net(bals, 'hA')).toBe(3000); // Alice a payé 60, doit 30 → +30
		expect(net(bals, 'hB')).toBe(-3000); // Bob doit 30
		expect(net(bals, 'hC')).toBe(0); // aucun mouvement
	});

	it('foyer à plusieurs membres : les parts se combinent', () => {
		const participants = [P('alice', 'hAB'), P('bob', 'hAB'), P('chloe', 'hC')];
		const expenses = [E('e1', 'alice', 9000)];
		const beneficiaries = [B('e1', 'alice', 3000), B('e1', 'bob', 3000), B('e1', 'chloe', 3000)];

		const bals = computeBalances(participants, expenses, beneficiaries);
		expect(bals).toHaveLength(2);
		expect(net(bals, 'hAB')).toBe(3000); // payé 90 par Alice, dû 30+30 → +30
		expect(net(bals, 'hC')).toBe(-3000);
	});

	it('un participant inactif compte quand même (la vue ne filtre pas active)', () => {
		const participants = [P('alice', 'hA'), P('bob', 'hB', false)];
		const expenses = [E('e1', 'bob', 4000)];
		const beneficiaries = [B('e1', 'alice', 2000), B('e1', 'bob', 2000)];

		const bals = computeBalances(participants, expenses, beneficiaries);
		expect(net(bals, 'hB')).toBe(2000); // Bob (inactif) a payé 40, doit 20 → +20
		expect(net(bals, 'hA')).toBe(-2000);
	});

	it('une dépense supprimée (absente de la liste) est exclue', () => {
		const participants = [P('alice', 'hA'), P('bob', 'hB')];
		const expenses: Expense[] = []; // e1 « supprimée » → hors liste
		const beneficiaries = [B('e1', 'alice', 3000), B('e1', 'bob', 3000)]; // rangs orphelins

		const bals = computeBalances(participants, expenses, beneficiaries);
		expect(net(bals, 'hA')).toBe(0);
		expect(net(bals, 'hB')).toBe(0);
	});
});
