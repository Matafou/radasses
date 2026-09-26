import type { BeneficiaryInput, ResolvedBeneficiary } from '$lib/backend';

export type SplitPreview = { amounts?: Record<string, number>; error?: string };

/** Poids en millièmes entiers (le poids est saisi avec au plus 3 décimales). */
const toMilli = (w: number) => BigInt(Math.round(w * 1000));

/**
 * Répartition AUTORITAIRE d'une dépense (reprise de l'ancienne fonction SQL
 * `compute_split`) : l'adaptateur backend l'applique à l'enregistrement, le
 * formulaire l'utilise en prévisualisation (`previewSplit`).
 *
 * - Les verrouillés gardent leur montant ; le reste est réparti entre les
 *   non-verrouillés au prorata des poids (tous ou aucun ; aucun = parts égales).
 * - Arrondi « plus grands restes » en arithmétique EXACTE (BigInt, poids en
 *   millièmes) ; égalité départagée par person_id croissant.
 * - Sortie : non-verrouillés dans l'ordre de saisie, puis verrouillés.
 *
 * Renvoie soit { beneficiaries }, soit { error } (message affichable).
 */
export function resolveSplit(
	totalCents: number,
	benefs: BeneficiaryInput[]
): { beneficiaries: ResolvedBeneficiary[]; error?: undefined } | { error: string } {
	if (!Number.isInteger(totalCents) || totalCents < 0) return { error: 'Montant négatif.' };
	if (!benefs.length) return { error: 'Aucun bénéficiaire fourni.' };
	if (new Set(benefs.map((b) => b.person_id)).size !== benefs.length)
		return { error: 'Bénéficiaire en double.' };
	const locked = benefs.filter((b) => b.is_locked);
	const unlocked = benefs.filter((b) => !b.is_locked);
	if (locked.some((b) => !Number.isInteger(b.amount_cents ?? 0) || (b.amount_cents ?? 0) < 0))
		return { error: 'Montant fixe invalide.' };
	if (unlocked.some((b) => b.weight != null && !(Number(b.weight) >= 0)))
		return { error: 'Poids invalide.' };
	const lockedSum = locked.reduce((s, b) => s + (b.amount_cents ?? 0), 0);

	if (unlocked.length < 1)
		return { error: 'Ajoute au moins un bénéficiaire en poids (pour absorber le reste).' };
	// Parmi les non-verrouillés, c'est tout ou rien — soit tous ont un poids, soit
	// aucun (parts égales). Un mélange est rejeté.
	const weighted = unlocked.filter((b) => b.weight != null).length;
	if (weighted > 0 && weighted < unlocked.length)
		return {
			error: 'Poids incohérents : mélange de bénéficiaires avec et sans poids (tout ou rien).'
		};
	if (lockedSum > totalCents) return { error: 'Les montants fixes dépassent le total.' };

	const remainder = BigInt(totalCents - lockedSum);
	const rawW = unlocked.map((b) => (b.weight == null ? 0n : toMilli(Number(b.weight))));
	const sumRaw = rawW.reduce((a, b) => a + b, 0n);
	const w = sumRaw === 0n ? unlocked.map(() => 1n) : rawW;
	const sumW = w.reduce((a, b) => a + b, 0n);

	// base = floor(reste × w / Σw), rest = partie fractionnaire × Σw (même dénominateur
	// pour tous → comparaison exacte des restes).
	const base = w.map((x) => (remainder * x) / sumW);
	const rest = w.map((x) => (remainder * x) % sumW);
	let leftover = remainder - base.reduce((a, b) => a + b, 0n);

	const amounts = base.map(Number);
	const order = unlocked
		.map((b, i) => ({ i, pid: b.person_id, rest: rest[i] }))
		.sort((a, b) => (a.rest === b.rest ? (a.pid < b.pid ? -1 : 1) : a.rest > b.rest ? -1 : 1));
	for (const o of order) {
		if (leftover <= 0n) break;
		amounts[o.i] += 1;
		leftover -= 1n;
	}

	return {
		beneficiaries: [
			...unlocked.map((b, i) => ({
				person_id: b.person_id,
				is_locked: false,
				weight: b.weight ?? null,
				amount_cents: amounts[i]
			})),
			...locked.map((b) => ({
				person_id: b.person_id,
				is_locked: true,
				weight: b.weight ?? null,
				amount_cents: b.amount_cents ?? 0
			}))
		]
	};
}

/**
 * Prévisualisation client de la répartition (formulaire, ajout hors-ligne) : même
 * calcul que `resolveSplit`, mais tolérante aux états intermédiaires de saisie
 * (montants fixes négatifs/décimaux ramenés à l'entier ≥ 0).
 */
export function previewSplit(totalCents: number, benefs: BeneficiaryInput[]): SplitPreview {
	if (!benefs.length) return {};
	const clean = benefs.map((b) =>
		b.is_locked ? { ...b, amount_cents: Math.max(0, Math.round(b.amount_cents ?? 0)) } : b
	);
	const r = resolveSplit(Math.round(totalCents), clean);
	if (r.error !== undefined) return { error: r.error };
	return { amounts: Object.fromEntries(r.beneficiaries.map((b) => [b.person_id, b.amount_cents])) };
}
