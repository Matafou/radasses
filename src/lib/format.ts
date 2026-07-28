/** Centimes -> montant formaté (français) dans la devise donnée. */
export function money(cents: number, currency = 'EUR'): string {
	return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents ?? 0) / 100);
}

/** Raccourci euros (compat). */
export function euros(cents: number): string {
	return money(cents, 'EUR');
}

/** "12,34" ou "12.34" -> 1234 centimes. NaN si invalide. */
export function centsFromEuros(input: string): number {
	const n = Number(String(input).replace(',', '.').trim());
	if (!Number.isFinite(n)) return NaN;
	return Math.round(n * 100);
}
