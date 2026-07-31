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
					<!-- Ligne 1 : titre (police ajustée) + date, montant à droite. -->
					<div class="flex items-baseline gap-2">
						<h3 use:fitText={e.description} class="min-w-0 shrink truncate font-medium">
							{e.description || 'Dépense'}
						</h3>
						<MetaText class="shrink-0">{e.spent_on}</MetaText>
						<p class="ml-auto shrink-0 font-semibold">{fmt(e.amount_cents)}</p>
					</div>
					<!-- Ligne 2 : payeur → bénéficiaires (scrollable) + boutons. -->
					<div class="mt-1 flex items-center gap-2">
						<span class="shrink-0 text-xs text-slate-600" title="payé par {payer}">{payer}</span>
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
						<div class="flex shrink-0 items-center gap-2">
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
				</Card>
			</li>
		{:else}
			<li>
				<EmptyState>Aucune dépense pour l'instant. Touchez « + » pour en ajouter une.</EmptyState>
			</li>
		{/each}
	</ul>
</section>
