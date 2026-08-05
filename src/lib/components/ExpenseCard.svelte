<script lang="ts">
	// Carte d'une dépense, mutualisée entre l'onglet Dépenses et les vues de détail
	// crédit/débit (page personne, accordéon foyer). Lit l'état du séjour et gère
	// l'édition/suppression via le formulaire du layout (bottom-sheet).
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowRight, Lock, Pencil, Trash2 } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import { money } from '$lib/format';
	import { scrollShadow } from '$lib/actions/scrollShadow';
	import { fitText } from '$lib/actions/fitText';
	import { Card, IconButton, MetaText } from '$lib/components/ui';
	import type { Expense } from '$lib/backend';

	let {
		expense,
		shareCents = null
	}: {
		expense: Expense;
		/** Si fourni (vue « payé pour lui »), affiche cette PART en gros + le total en petit. */
		shareCents?: number | null;
	} = $props();

	const tripState = getTripState();
	const fmt = (c: number) => money(c, tripState.currency);

	/**
	 * Regroupe les bénéficiaires d'une dépense qui partagent le même montant (et le
	 * même statut verrouillé) → « Julie, Pierre, Adama : 12,56 € », plus compact que
	 * ligne par ligne. Trié par montant décroissant.
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

	async function onDelete() {
		if (!confirm('Supprimer cette dépense ?')) return;
		try {
			await tripState.removeExpense(expense);
			if (tripState.editingExpense?.id === expense.id) tripState.closeExpenseForm();
		} catch (err) {
			tripState.error = err instanceof Error ? err.message : String(err);
		}
	}

	const groups = $derived(benefGroups(expense.id));
	const payer = $derived(tripState.personName.get(expense.paid_by_person_id) ?? '?');
</script>

<Card class={tripState.editingExpense?.id === expense.id ? 'border-slate-900' : ''}>
	<!--
		Conteneur de requête partagé par toutes les lignes → réaction commune au
		« mode agrandi » (container query en `em`, seuil 17em calibré). Réagit au
		réglage TAILLE DU TEXTE (Android/desktop), pas au zoom. Effets : ligne 1 titre
		pleine largeur (date+montant dessous) ; « payeur → bénéficiaires » bascule
		entier sous les boutons ; boutons toujours à droite.
	-->
	<div class="@container">
		<!-- Ligne 1 : titre (police ajustée par fitText) + date + montant. -->
		<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
			<h3
				use:fitText={expense.description}
				class="min-w-0 shrink truncate font-medium @max-[17em]:basis-full"
			>
				{expense.description || 'Dépense'}
			</h3>
			<MetaText class="shrink-0">{expense.spent_on}</MetaText>
			{#if shareCents != null}
				<!-- Vue « payé pour lui » : la PART pour le sujet prime sur le total. -->
				<div class="ml-auto shrink-0 text-right leading-tight">
					<span class="block text-lg font-bold tabular-nums">{fmt(shareCents)}</span>
					<MetaText class="block text-xs">sur {fmt(expense.amount_cents)}</MetaText>
				</div>
			{:else}
				<p class="ml-auto shrink-0 font-semibold">{fmt(expense.amount_cents)}</p>
			{/if}
		</div>

		<!-- Ligne 2 : payeur → bénéficiaires + boutons. -->
		<div class="mt-1 flex flex-wrap items-center gap-2">
			<div
				class="flex min-w-0 flex-1 items-center gap-2 @max-[17em]:order-1 @max-[17em]:basis-full"
			>
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
			</div>
			<div class="flex shrink-0 items-center gap-2 @max-[17em]:ml-auto">
				<IconButton
					icon={Pencil}
					label="Modifier"
					variant="warning"
					onclick={() => tripState.openEditExpense(expense)}
				/>
				<IconButton icon={Trash2} label="Supprimer" variant="danger" onclick={onDelete} />
			</div>
		</div>
	</div>
</Card>
