import { describe, expect, it } from 'vitest';
import { inverseExpenseOp, isUndoable } from './undo';
import type { Operation } from '$lib/backend';

let seq = 0;
function op(
	entity_id: string,
	action: string,
	before: unknown,
	after: unknown,
	entity_type = 'expense'
): Operation {
	return {
		id: ++seq,
		actor_auth_user_id: null,
		entity_type,
		entity_id,
		action,
		before,
		after,
		created_at: 'c'
	};
}

const expenseSnap = (id: string, amount: number, version: number) => ({
	expense: {
		id,
		description: 'X',
		category: null,
		amount_cents: amount,
		spent_on: '2026-01-01',
		paid_by_person_id: 'pA',
		version
	},
	beneficiaries: [
		{ person_id: 'pA', is_locked: false, weight: null, amount_cents: amount / 2 },
		{ person_id: 'pB', is_locked: false, weight: null, amount_cents: amount / 2 }
	]
});

describe('inverseExpenseOp', () => {
	it('ajout → suppression (verrou = version courante)', () => {
		const o = op('e1', 'create', null, expenseSnap('e1', 6000, 1));
		expect(inverseExpenseOp(o)).toEqual({ kind: 'delete', expense_id: 'e1', expected_version: 1 });
	});

	it('modification → restaure le before (même id, verrou = version après)', () => {
		const o = op('e1', 'update', expenseSnap('e1', 4000, 1), expenseSnap('e1', 6000, 2));
		const inv = inverseExpenseOp(o);
		expect(inv?.kind).toBe('save');
		if (inv?.kind === 'save') {
			expect(inv.input.expense_id).toBe('e1');
			expect(inv.input.expected_version).toBe(2);
			expect(inv.input.amount_cents).toBe(4000); // valeurs d'AVANT
			expect(inv.input.beneficiaries).toHaveLength(2);
		}
	});

	it('suppression → re-création (nouvel id : expense_id null)', () => {
		const o = op('e1', 'delete', expenseSnap('e1', 6000, 3), null);
		const inv = inverseExpenseOp(o);
		expect(inv?.kind).toBe('save');
		if (inv?.kind === 'save') {
			expect(inv.input.expense_id).toBe(null);
			expect(inv.input.expected_version).toBeUndefined();
			expect(inv.input.amount_cents).toBe(6000);
		}
	});
});

describe('isUndoable (dernière op de l’entité)', () => {
	it('vraie pour la dernière op de dépense de son entité', () => {
		seq = 0;
		const a = op('e1', 'create', null, expenseSnap('e1', 6000, 1));
		const b = op('e2', 'create', null, expenseSnap('e2', 3000, 1)); // autre dépense
		expect(isUndoable(a, [a, b])).toBe(true); // e1 : indépendante, dernière (et seule) de e1
		expect(isUndoable(b, [a, b])).toBe(true);
	});

	it('fausse si une op POSTÉRIEURE concerne la même dépense', () => {
		seq = 0;
		const a = op('e1', 'create', null, expenseSnap('e1', 6000, 1));
		const c = op('e1', 'update', expenseSnap('e1', 6000, 1), expenseSnap('e1', 7000, 2));
		expect(isUndoable(a, [a, c])).toBe(false); // a n'est plus la dernière de e1
		expect(isUndoable(c, [a, c])).toBe(true); // c l'est
	});

	it('fausse pour une opération non-dépense', () => {
		seq = 0;
		const p = op('pA', 'update', { name: 'A' }, { name: 'B' }, 'person');
		expect(isUndoable(p, [p])).toBe(false);
	});
});
