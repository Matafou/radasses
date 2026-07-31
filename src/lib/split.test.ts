import { describe, expect, it } from 'vitest';
import { previewSplit } from './split';
import { splitCases } from './split.cases';

describe('previewSplit (miroir TS de compute_split)', () => {
	for (const c of splitCases) {
		it(c.name, () => {
			const result = previewSplit(c.totalCents, c.benefs);
			if ('error' in c.expected) {
				expect(result.error, 'un message d’erreur est attendu').toBeTruthy();
				expect(result.amounts).toBeUndefined();
			} else {
				expect(result.error).toBeUndefined();
				expect(result.amounts).toEqual(c.expected.amounts);
				// invariant fort : la somme des parts vaut toujours exactement le total
				const sum = Object.values(result.amounts ?? {}).reduce((a, b) => a + b, 0);
				expect(sum).toBe(c.totalCents);
			}
		});
	}
});
