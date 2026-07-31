import type { BeneficiaryInput } from '$lib/backend';

/**
 * Cas de test CANONIQUES de la répartition, source unique de vérité pour les
 * deux implémentations miroir :
 *   - `previewSplit` (TS)      → vérifié par `split.test.ts` (Vitest) ;
 *   - `compute_split` (SQL)    → vérifié par `supabase/tests/split_generated.test.sql`,
 *                                 fichier GÉNÉRÉ depuis ce module (`npm run gen:split-sql`).
 *
 * Toucher à l'algorithme ⇒ mettre à jour ce fichier ⇒ régénérer le SQL. Ainsi
 * les deux côtés ne peuvent plus diverger sans qu'un test échoue.
 *
 * Les person_id sont de vrais UUID : l'ordre de départage (« plus grands
 * restes », égalité tranchée par person_id) doit être identique en TS
 * (comparaison de chaînes) et en SQL (comparaison d'uuid) — or les deux
 * ordonnent la forme hexadécimale minuscule de la même façon.
 */
export const A = '00000000-0000-0000-0000-00000000000a';
export const B = '00000000-0000-0000-0000-00000000000b';
export const C = '00000000-0000-0000-0000-00000000000c';

export type SplitCase = {
	name: string;
	totalCents: number;
	benefs: BeneficiaryInput[];
	/** soit les montants attendus par person_id, soit une erreur attendue */
	expected: { amounts: Record<string, number> } | { error: true };
};

export const splitCases: SplitCase[] = [
	{
		name: 'parts égales 10c / 3 → plus grands restes (4,3,3)',
		totalCents: 10,
		benefs: [{ person_id: A }, { person_id: B }, { person_id: C }],
		expected: { amounts: { [A]: 4, [B]: 3, [C]: 3 } }
	},
	{
		name: 'parts égales 100c / 3 → (34,33,33)',
		totalCents: 100,
		benefs: [{ person_id: A }, { person_id: B }, { person_id: C }],
		expected: { amounts: { [A]: 34, [B]: 33, [C]: 33 } }
	},
	{
		name: 'parts égales 1001c / 2 → départage par person_id (501,500)',
		totalCents: 1001,
		benefs: [{ person_id: A }, { person_id: B }],
		expected: { amounts: { [A]: 501, [B]: 500 } }
	},
	{
		name: 'poids 50/30/20 sur 100,00 €',
		totalCents: 10000,
		benefs: [
			{ person_id: A, weight: 50 },
			{ person_id: B, weight: 30 },
			{ person_id: C, weight: 20 }
		],
		expected: { amounts: { [A]: 5000, [B]: 3000, [C]: 2000 } }
	},
	{
		name: 'montant verrouillé conservé + reste partagé',
		totalCents: 5000,
		benefs: [
			{ person_id: A, is_locked: true, amount_cents: 2000 },
			{ person_id: B },
			{ person_id: C }
		],
		expected: { amounts: { [A]: 2000, [B]: 1500, [C]: 1500 } }
	},
	{
		name: 'un seul bénéficiaire reçoit tout (remboursement)',
		totalCents: 3000,
		benefs: [{ person_id: C }],
		expected: { amounts: { [C]: 3000 } }
	},
	{
		name: 'rejet : tout verrouillé (aucun tampon)',
		totalCents: 10000,
		benefs: [
			{ person_id: A, is_locked: true, amount_cents: 5000 },
			{ person_id: B, is_locked: true, amount_cents: 5000 }
		],
		expected: { error: true }
	},
	{
		name: 'rejet : verrouillés > total',
		totalCents: 1000,
		benefs: [{ person_id: A, is_locked: true, amount_cents: 5000 }, { person_id: B }],
		expected: { error: true }
	},
	{
		name: 'rejet : mélange de poids (un avec, un sans)',
		totalCents: 10000,
		benefs: [{ person_id: A, weight: 50 }, { person_id: B }],
		expected: { error: true }
	}
];
