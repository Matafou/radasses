import { describe, expect, test } from 'vitest';
import { moneyRounded } from './format';

// On évite d'asserter la chaîne exacte (Intl insère une espace insécable étroite
// avant « € ») : on vérifie la logique d'arrondi via la présence/absence de décimale.
describe('moneyRounded', () => {
	test('arrondit à l’entier le plus proche, sans décimale', () => {
		expect(moneyRounded(1317)).toContain('13'); // 13,17 -> 13
		expect(moneyRounded(1317)).not.toContain(',');
		expect(moneyRounded(1350)).toContain('14'); // 13,50 -> 14
		expect(moneyRounded(1349)).toContain('13'); // 13,49 -> 13
	});

	test('gère zéro et les négatifs', () => {
		expect(moneyRounded(0)).toContain('0');
		expect(moneyRounded(-333)).toContain('3'); // -3,33 -> -3
		expect(moneyRounded(-333)).toContain('-');
		expect(moneyRounded(-333)).not.toContain(',');
	});
});
