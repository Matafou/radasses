<script lang="ts">
	// Relevé crédit/débit d'un sujet (une personne, ou les membres d'un foyer),
	// mutualisé entre la page personne et l'accordéon foyer (onglet Soldes). Net en
	// tête, puis DEUX sections — « payé par lui » (crédit) et « payé pour lui »
	// (débit) — dont les dépenses réutilisent la MÊME carte que l'onglet Dépenses
	// (`ExpenseCard`). « Payé pour lui » ne liste que les dépenses payées par
	// D'AUTRES (celles qu'il a payées lui-même sont déjà dans « payé par lui ») ;
	// son total est la somme des parts affichées.
	import { getTripState } from '$lib/trip.svelte';
	import { computeBalanceDetail } from '$lib/balance-detail';
	import { money } from '$lib/format';
	import ExpenseCard from '$lib/components/ExpenseCard.svelte';
	import { EmptyState, MetaText } from '$lib/components/ui';

	let { personIds }: { personIds: string[] } = $props();

	const tripState = getTripState();
	const fmt = (c: number) => money(c, tripState.currency);
	const detail = $derived(
		computeBalanceDetail(personIds, tripState.expenses, tripState.beneficiaries)
	);
	const byId = $derived(new Map(tripState.expenses.map((e) => [e.id, e])));
	const paidLines = $derived(detail.lines.filter((l) => l.paid_cents > 0));
	// « payé pour lui » = dépenses payées par d'AUTRES (pas par le sujet), sinon
	// doublon avec « payé par lui ». Le total de la section suit ce qui est affiché.
	const owedLines = $derived(
		detail.lines.filter((l) => l.owed_cents > 0 && l.paid_cents === 0)
	);
	const owedShownCents = $derived(owedLines.reduce((s, l) => s + l.owed_cents, 0));
	const netClass = $derived(
		detail.net_cents > 0
			? 'text-emerald-600'
			: detail.net_cents < 0
				? 'text-red-600'
				: 'text-slate-400'
	);
</script>

<div class="space-y-4">
	<!-- Net. -->
	<div class="flex items-center justify-between text-sm">
		<span class="font-medium">Net</span>
		<span>
			<span class="font-semibold tabular-nums {netClass}"
				>{detail.net_cents > 0 ? '+' : ''}{fmt(detail.net_cents)}</span
			>
			<MetaText class="ml-1">
				{detail.net_cents > 0 ? 'on lui doit' : detail.net_cents < 0 ? 'doit' : ''}
			</MetaText>
		</span>
	</div>

	<!-- Payé par lui (crédit). -->
	<section class="space-y-2">
		<div
			class="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800"
		>
			<span>Payé par lui</span>
			<span class="tabular-nums">{fmt(detail.paid_cents)}</span>
		</div>
		{#if paidLines.length}
			<ul class="space-y-2">
				{#each paidLines as l (l.expense_id)}
					{@const e = byId.get(l.expense_id)}
					{#if e}<li><ExpenseCard expense={e} /></li>{/if}
				{/each}
			</ul>
		{:else}
			<EmptyState class="p-3">Rien payé.</EmptyState>
		{/if}
	</section>

	<!-- Payé pour lui (débit = sa part). -->
	<section class="space-y-2">
		<div
			class="flex items-center justify-between rounded-md bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800"
		>
			<span>Payé pour lui</span>
			<span class="tabular-nums">{fmt(owedShownCents)}</span>
		</div>
		{#if owedLines.length}
			<ul class="space-y-2">
				{#each owedLines as l (l.expense_id)}
					{@const e = byId.get(l.expense_id)}
					{#if e}<li><ExpenseCard expense={e} shareCents={l.owed_cents} /></li>{/if}
				{/each}
			</ul>
		{:else}
			<EmptyState class="p-3">Aucune dépense à sa charge.</EmptyState>
		{/if}
	</section>
</div>
