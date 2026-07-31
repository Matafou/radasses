<script lang="ts">
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowRight, Lock, Pencil, Trash2 } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import { money } from '$lib/format';
	import { scrollShadow } from '$lib/actions/scrollShadow';
	import { fitText } from '$lib/actions/fitText';
	import { Card, EmptyState, IconButton, MetaText } from '$lib/components/ui';
	import type { Expense } from '$lib/backend';

	const tripState = getTripState();
	const fmt = (c: number) => money(c, tripState.currency);
	// Le formulaire de dépense (création/édition) vit dans le layout (bottom-sheet) :
	// ici on ne fait qu'ouvrir l'édition d'une ligne.

	/**
	 * Regroupe les bénéficiaires d'une dépense qui partagent le même montant (et
	 * le même statut verrouillé) → « Julie, Pierre, Adama : 12,56 € », plus compact
	 * que ligne par ligne. Trié par montant décroissant.
	 */
	function benefGroups(expenseId: string) {
		const benefs = tripState.benefByExpense.get(expenseId) ?? [];
		const groups: Record<string, { amount: number; locked: boolean; names: string[] }> = {};
		for (const b of benefs) {
			const key = `${b.amount_cents}|${b.is_locked}`;
			const g = (groups[key] ??= { amount: b.amount_cents, locked: b.is_locked, names: [] });
			g.names.push(tripState.personName.get(b.person_id) ?? '?');
		}
		return Object.values(groups)
			.sort((a, b) => b.amount - a.amount)
			.map((g) => ({ amount: g.amount, locked: g.locked, names: g.names.join(', ') }));
	}

	async function onDelete(exp: Expense) {
		if (!confirm('Supprimer cette dépense ?')) return;
		try {
			await tripState.removeExpense(exp);
			if (tripState.editingExpense?.id === exp.id) tripState.closeExpenseForm();
		} catch (err) {
			tripState.error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<section class="space-y-2">
	<ul class="space-y-2">
		{#each tripState.expenses as e (e.id)}
			<li>
				<Card class={tripState.editingExpense?.id === e.id ? 'border-slate-900' : ''}>
					{@const groups = benefGroups(e.id)}
					{@const payer = tripState.personName.get(e.paid_by_person_id) ?? '?'}
					<!--
						Toutes les lignes de la carte partagent ce conteneur de requête, pour
						réagir ENSEMBLE au « mode agrandi ».

						Déclencheur = CONTAINER QUERY en `em` (`@container` + `@max-[17em]:`) : le
						`em` se calcule sur la police du conteneur, qui suit le réglage « taille du
						texte » de l'utilisateur. La règle est VRAIE quand largeur_carte(px) ≤ 17 ×
						police(px) — c.-à-d. quand le texte est grand par rapport à la largeur. Seuil
						17em calibré (mesuré : ~302px de large sur un écran de 360px) : à 16px un
						téléphone ≥360px reste compact et bascule vers ~18px ; les très petits écrans
						(<340px) basculent dès le texte normal — voulu. ⚠️ Réagit au réglage TAILLE
						DU TEXTE (Android/desktop), PAS au zoom (px et em grandissent ensemble). Sur
						iOS, le Dynamic Type ne redimensionne pas le rem des pages web → pas de
						bascule (le zoom prend le relais).

						Effets en mode agrandi :
						- ligne 1 : le titre passe pleine largeur (il reste grand), date+montant dessous ;
						- « payeur → bénéficiaires » : bascule en entier sous les boutons ;
						- boutons : toujours poussés à droite.
					-->
					<div class="@container">
						<!-- Ligne 1 : titre (police ajustée par fitText) + date + montant. -->
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
							<h3
								use:fitText={e.description}
								class="min-w-0 shrink truncate font-medium @max-[17em]:basis-full"
							>
								{e.description || 'Dépense'}
							</h3>
							<MetaText class="shrink-0">{e.spent_on}</MetaText>
							<p class="ml-auto shrink-0 font-semibold">{fmt(e.amount_cents)}</p>
						</div>

						<!-- Ligne 2 : payeur → bénéficiaires + boutons. -->
						<div class="mt-1 flex flex-wrap items-center gap-2">
							<!-- Groupe « payeur → bénéficiaires » : en mode agrandi il bascule ENTIER
							     (payeur + flèche + liste) sur sa propre ligne (order + basis-full). -->
							<div
								class="flex min-w-0 flex-1 items-center gap-2 @max-[17em]:order-1 @max-[17em]:basis-full"
							>
								<span class="shrink-0 text-xs text-slate-600" title="payé par {payer}">{payer}</span
								>
								<ArrowRight size={16} class="shrink-0 text-slate-400" aria-label="a payé pour" />
								<div
									use:scrollShadow={groups}
									class="hide-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto text-xs text-slate-500"
								>
									{#each groups as g, i (i)}
										<span class="benef-item shrink-0 whitespace-nowrap"
											>{g.names} : {fmt(g.amount)}{#if g.locked}<Lock
													size={12}
													class="ml-0.5 inline align-middle"
													aria-label="montant verrouillé"
												/>{/if}</span
										>
									{/each}
								</div>
							</div>
							<!-- Boutons : toujours poussés à droite (seuls sur leur ligne en mode agrandi). -->
							<div class="flex shrink-0 items-center gap-2 @max-[17em]:ml-auto">
								<IconButton
									icon={Pencil}
									label="Modifier"
									variant="warning"
									onclick={() => tripState.openEditExpense(e)}
								/>
								<IconButton
									icon={Trash2}
									label="Supprimer"
									variant="danger"
									onclick={() => onDelete(e)}
								/>
							</div>
						</div>
					</div>
				</Card>
			</li>
		{:else}
			<li>
				<EmptyState>Aucune dépense pour l'instant. Touchez « + » pour en ajouter une.</EmptyState>
			</li>
		{/each}
	</ul>
</section>
