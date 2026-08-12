<script lang="ts">
	import { resolve } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowRight, Check, ChevronRight, Plus } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import { pullToRefresh } from '$lib/actions/pullToRefresh';
	import { prefs } from '$lib/prefs.svelte';
	import type { Transfer } from '$lib/settlements';
	import { foyerLabel, money } from '$lib/format';
	import RoundableAmount from '$lib/components/RoundableAmount.svelte';
	import {
		Button,
		EmptyState,
		ListRow,
		MetaText,
		PanelList,
		SectionHeader
	} from '$lib/components/ui';

	const tripState = getTripState();

	// Masquage des soldes/remboursements négligeables (< seuil appareil, défaut 1 €).
	// Un lien permet de les révéler ponctuellement (état local, non persisté).
	let revealSmall = $state(false);
	const threshold = $derived(prefs.hideBelowCents);
	const shownBalances = $derived(
		revealSmall || threshold === 0
			? tripState.balances
			: tripState.balances.filter((b) => Math.abs(b.net_cents) >= threshold)
	);
	const shownTransfers = $derived(
		revealSmall || threshold === 0
			? tripState.transfers
			: tripState.transfers.filter((t) => t.amount_cents >= threshold)
	);
	const hiddenCount = $derived(
		tripState.balances.length -
			shownBalances.length +
			(tripState.transfers.length - shownTransfers.length)
	);

	// État « déplié » (montant exact révélé) de chaque suggestion, indexé par foyers.
	// Permet de préremplir le remboursement avec l'exact quand l'utilisateur a cliqué
	// sur le montant pour l'afficher.
	let revealedTransfers = $state<Record<string, boolean>>({});
	const transferKey = (t: Transfer) => t.from_household_id + t.to_household_id;

	// Un remboursement = une dépense : le débiteur « paie » le créditeur.
	// On préremplit le formulaire de dépense (bottom-sheet du layout) pour ajuster/valider.
	// Montant prérempli = celui AFFICHÉ : arrondi si l'option est active et que la suggestion
	// n'a pas été dépliée ; exact sinon (option coupée, ou montant révélé au clic).
	function onReimburse(t: Transfer, revealed: boolean) {
		const from = tripState.participants.find(
			(p) => p.household_id === t.from_household_id
		)?.person_id;
		const to = tripState.participants.find((p) => p.household_id === t.to_household_id)?.person_id;
		if (!from || !to) return;
		const useExact = !prefs.roundAmounts || revealed;
		const amount = useExact ? t.amount_cents : Math.round(t.amount_cents / 100) * 100;
		tripState.openReimbursement({
			from_person_id: from,
			to_person_id: to,
			amount_cents: amount
		});
	}
</script>

<div class="flex h-full flex-col gap-4">
	<!-- Soldes par foyer : moitié haute, liste scrollable -->
	<section class="flex min-h-0 flex-1 flex-col">
		<div class="mb-2">
			<SectionHeader title="Soldes par foyer" />
		</div>
		<!-- Le scroller du haut porte le pull-to-refresh (désactivé au niveau du layout). -->
		<div
			class="min-h-0 flex-1 overflow-y-auto"
			use:pullToRefresh={{ onRefresh: () => tripState.load() }}
		>
			<div data-ptr-content>
				<PanelList>
					{#each shownBalances as b (b.household_id)}
						<ListRow class="relative p-0">
							<!-- Lien plein-row (navigation) en dessous ; le contenu au-dessus laisse
						     passer les taps vers ce lien SAUF le montant (dépliable). -->
							<a
								class="absolute inset-0 hover:bg-slate-50"
								href={resolve('/t/[tripId]/foyer/[householdId]', {
									tripId: tripState.tripId,
									householdId: b.household_id
								})}
								aria-label={`Voir le détail de ${foyerLabel(
									tripState.householdName.get(b.household_id) ?? '?'
								)}`}
							></a>
							<div class="pointer-events-none relative flex items-center gap-2 px-4 py-3">
								<span class="min-w-0 flex-1 truncate first-letter:uppercase"
									>{foyerLabel(tripState.householdName.get(b.household_id) ?? '?')}</span
								>
								<span
									class="shrink-0 {b.net_cents > 0
										? 'font-medium text-emerald-600'
										: b.net_cents < 0
											? 'font-medium text-red-600'
											: 'text-slate-400'}"
								>
									{b.net_cents > 0 ? '+' : ''}<RoundableAmount
										cents={b.net_cents}
										currency={tripState.currency}
									/>
									<MetaText class="ml-1">
										{b.net_cents > 0 ? 'on lui doit' : b.net_cents < 0 ? 'doit' : ''}
									</MetaText>
								</span>
								<ChevronRight size={16} class="shrink-0 text-slate-400" aria-hidden="true" />
							</div>
						</ListRow>
					{:else}
						<ListRow class="text-sm text-slate-400">
							{tripState.balances.length ? 'Tous les soldes sont négligeables.' : 'Aucun solde.'}
						</ListRow>
					{/each}
				</PanelList>
			</div>
		</div>
	</section>

	<!-- Remboursements : moitié basse ; bouton manuel en tête, le reste scrollable -->
	<section class="flex min-h-0 flex-1 flex-col">
		<Button
			type="button"
			variant="outline"
			class="mb-2 w-full flex-col border-2 border-dashed border-emerald-500 bg-white text-center text-emerald-700 hover:bg-emerald-50"
			onclick={() => tripState.openReimbursement()}
		>
			<span class="inline-flex items-center gap-1">
				<Plus size={16} aria-hidden="true" />
				signaler un remboursement
			</span>
			<span class="block text-xs font-normal text-emerald-600"
				>en l'ajoutant aux dépenses enregistrées</span
			>
		</Button>
		<div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
			<MetaText class="block font-medium">Suggestions</MetaText>
			{#if shownTransfers.length}
				<PanelList>
					{#each shownTransfers as t (t.from_household_id + t.to_household_id)}
						{@const key = transferKey(t)}
						<ListRow class="flex items-center justify-between gap-2 text-sm">
							<span class="inline-flex min-w-0 flex-wrap items-center gap-1">
								<span class="font-medium first-letter:uppercase"
									>{foyerLabel(tripState.householdName.get(t.from_household_id) ?? '?')}</span
								>
								<ArrowRight size={14} class="text-slate-400" aria-hidden="true" />
								<span class="font-medium"
									>{foyerLabel(tripState.householdName.get(t.to_household_id) ?? '?')}</span
								>
								: <RoundableAmount
									cents={t.amount_cents}
									currency={tripState.currency}
									bind:revealed={revealedTransfers[key]}
								/>
							</span>
							<Button
								size="sm"
								variant="success"
								class="shrink-0 px-2 py-1 text-xs whitespace-nowrap"
								onclick={() => onReimburse(t, !!revealedTransfers[key])}
							>
								<Check size={14} aria-hidden="true" /> Remboursé !
							</Button>
						</ListRow>
					{/each}
				</PanelList>
			{:else}
				<EmptyState class="p-3">Tout est équilibré 🎉</EmptyState>
			{/if}
		</div>
	</section>

	{#if hiddenCount > 0 || revealSmall}
		<button
			type="button"
			class="link-inline meta-text flex-none self-center"
			onclick={() => (revealSmall = !revealSmall)}
		>
			{#if revealSmall}
				Masquer les soldes négligeables
			{:else}
				Afficher {hiddenCount} solde{hiddenCount > 1 ? 's' : ''} négligeable{hiddenCount > 1
					? 's'
					: ''} (&lt; {money(threshold, tripState.currency)})
			{/if}
		</button>
	{/if}
</div>
