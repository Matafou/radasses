/** Centimes -> montant formaté (français) dans la devise donnée. */
export function money(cents: number, currency = 'EUR'): string {
	return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents ?? 0) / 100);
}

/** Centimes -> montant ARRONDI à l'entier le plus proche (0 décimale), formaté. */
export function moneyRounded(cents: number, currency = 'EUR'): string {
	return new Intl.NumberFormat('fr-FR', {
		style: 'currency',
		currency,
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(Math.round((cents ?? 0) / 100));
}

/** Raccourci euros (compat). */
export function euros(cents: number): string {
	return money(cents, 'EUR');
}

/**
 * Libellé standard d'un foyer : « le foyer {nom} ». Centralisé ici pour une
 * dénomination cohérente partout (et pour l'i18n à venir). Minuscule (usage en
 * prose) ; ajouter `first-letter:uppercase` côté CSS quand c'est un titre.
 */
export function foyerLabel(name: string): string {
	return `le foyer ${name}`;
}

/** "12,34" ou "12.34" -> 12.34 (nombre). NaN si invalide. Tolère la virgule décimale FR. */
export function parseDecimalFr(input: string): number {
	return Number(String(input).replace(',', '.').trim());
}

/** "12,34" ou "12.34" -> 1234 centimes. NaN si invalide. */
export function centsFromEuros(input: string): number {
	const n = parseDecimalFr(input);
	if (!Number.isFinite(n)) return NaN;
	return Math.round(n * 100);
}
