import { describe, expect, it } from 'vitest';
import { computeBalanceDetail } from './balance-detail';
import type { Expense, Beneficiary } from '$lib/backend';

const exp = (id: string, payer: string, amount: number, on = '2026-08-01'): Expense => ({
	id,
	description: id,
	category: null,
	amount_cents: amount,
	spent_on: on,
	paid_by_person_id: payer,
	version: 1
});
const ben = (expense_id: string, person_id: string, amount: number): Beneficiary => ({
	expense_id,
	person_id,
	is_locked: false,
	weight: null,
	amount_cents: amount
});

describe('computeBalanceDetail', () => {
	// Alice paie 60 (Courses), partagé 30/30 entre Alice et Bob.
	const expenses = [exp('Courses', 'alice', 6000)];
	const beneficiaries = [ben('Courses', 'alice', 3000), ben('Courses', 'bob', 3000)];

	it('personne payeuse : crédit = montant payé, débit = sa part, net = solde', () => {
		const d = computeBalanceDetail(['alice'], expenses, beneficiaries);
		expect(d.paid_cents).toBe(6000);
		expect(d.owed_cents).toBe(3000);
		expect(d.net_cents).toBe(3000);
		expect(d.lines).toHaveLength(1);
		expect(d.lines[0]).toMatchObject({ paid_cents: 6000, owed_cents: 3000 });
	});

	it('personne bénéficiaire non payeuse : uniquement un débit', () => {
		const d = computeBalanceDetail(['bob'], expenses, beneficiaries);
		expect(d.paid_cents).toBe(0);
		expect(d.owed_cents).toBe(3000);
		expect(d.net_cents).toBe(-3000);
	});

	it('foyer = somme des membres ; un foyer contenant tout le monde a un net nul', () => {
		const d = computeBalanceDetail(['alice', 'bob'], expenses, beneficiaries);
		expect(d.paid_cents).toBe(6000);
		expect(d.owed_cents).toBe(6000);
		expect(d.net_cents).toBe(0);
	});

	it('ignore les dépenses sans lien avec le sujet', () => {
		const more = [...expenses, exp('Solo', 'carol', 1000)];
		const moreBen = [...beneficiaries, ben('Solo', 'carol', 1000)];
		const d = computeBalanceDetail(['alice'], more, moreBen);
		expect(d.lines.map((l) => l.expense_id)).toEqual(['Courses']);
	});
});
