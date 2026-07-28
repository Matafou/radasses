/** Centimes -> "12,34 €" (format français). */
export function euros(cents: number): string {
	return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
		(cents ?? 0) / 100
	);
}

/** "12,34" ou "12.34" -> 1234 centimes. NaN si invalide. */
export function centsFromEuros(input: string): number {
	const n = Number(String(input).replace(',', '.').trim());
	if (!Number.isFinite(n)) return NaN;
	return Math.round(n * 100);
}
