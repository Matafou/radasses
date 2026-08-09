<script lang="ts">
	// Relevé crédit/débit d'un sujet (une personne, ou les membres d'un foyer),
	// mutualisé entre la page personne et la page foyer. Net en tête, puis DEUX
	// sections — « payé par {sujet} » (crédit) et « payé pour {sujet} » (débit) —
	// dont les dépenses réutilisent la MÊME carte que l'onglet Dépenses (`ExpenseCard`).
	// Côté crédit, chaque carte affiche la part PAYÉE POUR LES AUTRES (payé − sa
	// part) et le bandeau montre le brut payé « (dont X pour les autres) ». « Payé
	// pour {sujet} » ne liste que les dépenses payées par D'AUTRES (celles qu'il a
	// payées lui-même sont déjà à gauche) ; son total = somme des parts affichées.
	// Ainsi Net = Σ(pour les autres) − Σ(payé pour lui).
	import { getTripState } from '$lib/trip.svelte';
	import { computeBalanceDetail } from '$lib/balance-detail';
	import { money } from '$lib/format';
	import ExpenseCard from '$lib/components/ExpenseCard.svelte';
	import { EmptyState, MetaText } from '$lib/components/ui';

	let { personIds, subjectName }: { personIds: string[]; subjectName: string } = $props();

	const tripState = getTripState();
	const fmt = (c: number) => money(c, tripState.currency);
	const detail = $derived(
		computeBalanceDetail(personIds, tripState.liveExpenses, tripState.beneficiaries)
	);
	const byId = $derived(new Map(tripState.liveExpenses.map((e) => [e.id, e])));
	const paidLines = $derived(detail.lines.filter((l) => l.paid_cents > 0));
	// Part payée POUR LES AUTRES sur chaque dépense = payé − sa propre part. Sa
	// somme est ce qui pèse réellement au crédit : Net = Σ(pour les autres) −
	// Σ(payé pour lui). Le bandeau montre le brut ET, entre parenthèses, ce total.
	const paidForOthersCents = $derived(
		paidLines.reduce((s, l) => s + (l.paid_cents - l.owed_cents), 0)
	);
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

	<!-- Payé par lui (crédit) : total brut payé, dont la part pour les autres.
	     Fond vert sur toute la section (cartes blanches en contraste). -->
	<section class="space-y-2 rounded-lg bg-emerald-50 p-3">
		<div class="text-sm font-semibold text-emerald-800">
			<!-- Ligne 1 : titre + total brut en bout de ligne. -->
			<div class="flex flex-wrap items-center justify-between gap-x-2">
				<span>Payé par {subjectName}</span>
				<span class="tabular-nums">{fmt(detail.paid_cents)}</span>
			</div>
			<!-- Ligne 2 : « dont pour les autres : » + son montant (même graisse), à droite. -->
			{#if paidLines.length}
				<div class="flex items-baseline justify-end gap-x-1">
					<span class="text-xs font-normal text-emerald-700">dont pour les autres :</span>
					<span class="tabular-nums">{fmt(paidForOthersCents)}</span>
				</div>
			{/if}
		</div>
		{#if paidLines.length}
			<ul class="space-y-2">
				{#each paidLines as l (l.expense_id)}
					{@const e = byId.get(l.expense_id)}
					{#if e}
						<li>
							<ExpenseCard
								expense={e}
								shareCents={l.paid_cents - l.owed_cents}
								shareLabel="pour les autres"
							/>
						</li>
					{/if}
				{/each}
			</ul>
		{:else}
			<EmptyState class="p-3">Rien payé.</EmptyState>
		{/if}
	</section>

	<!-- Payé pour lui (débit = sa part). Fond rouge clair sur toute la section. -->
	<section class="space-y-2 rounded-lg bg-red-50 p-3">
		<div
			class="flex flex-wrap items-center justify-between gap-x-2 text-sm font-semibold text-red-800"
		>
			<span>Payé pour {subjectName}</span>
			<span class="tabular-nums">{fmt(owedShownCents)}</span>
		</div>
		{#if owedLines.length}
			<ul class="space-y-2">
				{#each owedLines as l (l.expense_id)}
					{@const e = byId.get(l.expense_id)}
					{#if e}
						<li><ExpenseCard expense={e} shareCents={l.owed_cents} shareLabel={`pour ${subjectName}`} /></li>
					{/if}
				{/each}
			</ul>
		{:else}
			<EmptyState class="p-3">Aucune dépense à sa charge.</EmptyState>
		{/if}
	</section>
</div>
