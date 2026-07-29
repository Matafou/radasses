import type { BeneficiaryInput } from './expenses';

export type SplitPreview = { amounts?: Record<string, number>; error?: string };

/**
 * Prévisualisation client de la répartition — MIROIR EXACT de la fonction SQL
 * `compute_split` (mêmes poids, même arrondi « plus grands restes », même
 * départage par person_id). Sert à afficher les montants en direct dans le
 * formulaire ; la vérité reste le backend au moment de l'enregistrement.
 *
 * Renvoie soit { amounts }, soit { error } (au lieu de lever), pour un affichage
 * live tolérant aux états intermédiaires.
 */
export function previewSplit(totalCents: number, benefs: BeneficiaryInput[]): SplitPreview {
	if (!benefs.length) return {};
	const locked = benefs.filter((b) => b.is_locked);
	const unlocked = benefs.filter((b) => !b.is_locked);
	const lockedSum = locked.reduce((s, b) => s + Math.max(0, Math.round(b.amount_cents ?? 0)), 0);

	if (unlocked.length < 1)
		return { error: 'Ajoute au moins un bénéficiaire en poids (pour absorber le reste).' };
	if (lockedSum > totalCents) return { error: 'Les montants fixes dépassent le total.' };

	const remainder = totalCents - lockedSum;
	const rawW = unlocked.map((b) => (b.weight == null ? 0 : Number(b.weight)));
	const sumW = rawW.reduce((a, b) => a + b, 0);
	const w = sumW === 0 ? unlocked.map(() => 1) : rawW;
	const sumEff = w.reduce((a, b) => a + b, 0);

	const base = w.map((x) => Math.floor((remainder * x) / sumEff));
	const fracs = w.map((x, i) => (remainder * x) / sumEff - base[i]);
	const leftover = remainder - base.reduce((a, b) => a + b, 0);

	const amounts: Record<string, number> = {};
	locked.forEach((b) => (amounts[b.person_id] = Math.round(b.amount_cents ?? 0)));
	unlocked.forEach((b, i) => (amounts[b.person_id] = base[i]));

	// répartit les centimes restants aux plus grandes parts fractionnaires (départage person_id)
	const order = unlocked
		.map((b, i) => ({ pid: b.person_id, frac: fracs[i] }))
		.sort((a, b) => b.frac - a.frac || (a.pid < b.pid ? -1 : 1));
	for (let k = 0; k < leftover && k < order.length; k++) amounts[order[k].pid] += 1;

	return { amounts };
}
