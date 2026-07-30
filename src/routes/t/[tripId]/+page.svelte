<script lang="ts">
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { Lock, Pencil, Trash2 } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import type { Expense } from '$lib/backend';
	import { money } from '$lib/format';
	import { Card, EmptyState, IconButton, MetaText } from '$lib/components/ui';

	const tripState = getTripState();
	const fmt = (c: number) => money(c, tripState.currency);
	// Le formulaire de dépense (création/édition) vit dans le layout (bottom-sheet) :
	// ici on ne fait qu'ouvrir l'édition d'une ligne.

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
					<div class="flex items-start justify-between">
						<div>
							<p class="font-medium">{e.description || 'Dépense'}</p>
							<MetaText class="block">
								{e.spent_on} · payé par {tripState.personName.get(e.paid_by_person_id) ?? '?'}
							</MetaText>
						</div>
						<div class="text-right">
							<p class="font-semibold">{fmt(e.amount_cents)}</p>
							<div class="flex items-center justify-end gap-2">
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
					<ul class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
						{#each tripState.benefByExpense.get(e.id) ?? [] as b (b.person_id)}
							<li class="inline-flex items-center gap-0.5">
								{tripState.personName.get(b.person_id) ?? '?'} : {fmt(b.amount_cents)}
								{#if b.is_locked}<Lock size={12} aria-label="montant verrouillé" />{/if}
							</li>
						{/each}
					</ul>
				</Card>
			</li>
		{:else}
			<li>
				<EmptyState>Aucune dépense pour l'instant. Touchez « + » pour en ajouter une.</EmptyState>
			</li>
		{/each}
	</ul>
</section>
