<script lang="ts">
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowRight, Check, Plus } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import type { Settlement } from '$lib/backend';
	import type { Transfer } from '$lib/settlements';
	import { money } from '$lib/format';
	import {
		Button,
		EmptyState,
		ListRow,
		MetaText,
		PanelList,
		SectionHeader
	} from '$lib/components/ui';

	const tripState = getTripState();
	const fmt = (c: number) => money(c, tripState.currency);

	// Un remboursement = une dépense : le débiteur « paie » le créditeur.
	// On préremplit le formulaire de dépense (bottom-sheet du layout) pour ajuster/valider.
	function onReimburse(t: Transfer) {
		const from = tripState.participants.find(
			(p) => p.household_id === t.from_household_id
		)?.person_id;
		const to = tripState.participants.find((p) => p.household_id === t.to_household_id)?.person_id;
		if (!from || !to) return;
		tripState.openReimbursement({
			from_person_id: from,
			to_person_id: to,
			amount_cents: t.amount_cents
		});
	}
	async function onCancel(s: Settlement) {
		try {
			await tripState.unsettle(s);
		} catch (err) {
			tripState.error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<div class="flex h-full flex-col gap-4">
	<!-- Soldes par foyer : moitié haute, liste scrollable -->
	<section class="flex min-h-0 flex-1 flex-col">
		<div class="mb-2">
			<SectionHeader title="Soldes par foyer" />
		</div>
		<PanelList class="flex-1 overflow-y-auto">
			{#each tripState.balances as b (b.household_id)}
				<ListRow class="flex items-center justify-between">
					<span>{tripState.householdName.get(b.household_id) ?? '?'}</span>
					<span
						class={b.net_cents > 0
							? 'font-medium text-emerald-600'
							: b.net_cents < 0
								? 'font-medium text-red-600'
								: 'text-slate-400'}
					>
						{b.net_cents > 0 ? '+' : ''}{fmt(b.net_cents)}
						<MetaText class="ml-1">
							{b.net_cents > 0 ? 'on lui doit' : b.net_cents < 0 ? 'doit' : ''}
						</MetaText>
					</span>
				</ListRow>
			{:else}
				<ListRow class="text-sm text-slate-400">Aucun solde.</ListRow>
			{/each}
		</PanelList>
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
			{#if tripState.transfers.length}
				<PanelList>
					{#each tripState.transfers as t (t.from_household_id + t.to_household_id)}
						<ListRow class="flex items-center justify-between gap-2 text-sm">
							<span class="inline-flex min-w-0 flex-wrap items-center gap-1">
								<span class="font-medium"
									>{tripState.householdName.get(t.from_household_id) ?? '?'}</span
								>
								<ArrowRight size={14} class="text-slate-400" aria-hidden="true" />
								<span class="font-medium"
									>{tripState.householdName.get(t.to_household_id) ?? '?'}</span
								>
								: {fmt(t.amount_cents)}
							</span>
							<Button
								size="sm"
								variant="success"
								class="shrink-0 px-2 py-1 text-xs whitespace-nowrap"
								onclick={() => onReimburse(t)}
							>
								<Check size={14} aria-hidden="true" /> Remboursé !
							</Button>
						</ListRow>
					{/each}
				</PanelList>
			{:else}
				<EmptyState class="p-3">Tout est équilibré 🎉</EmptyState>
			{/if}

			{#if tripState.settlements.length}
				<details class="panel-surface p-3">
					<summary class="cursor-pointer text-sm text-slate-500">
						Remboursements enregistrés ({tripState.settlements.length})
					</summary>
					<ul class="mt-2 space-y-1">
						{#each tripState.settlements as s (s.id)}
							<li class="flex items-center justify-between text-sm">
								<span class="text-slate-600">
									{s.settled_on} · {tripState.householdName.get(s.from_household_id) ?? '?'} →
									{tripState.householdName.get(s.to_household_id) ?? '?'} : {fmt(s.amount_cents)}
								</span>
								<button class="text-xs text-red-500 underline" onclick={() => onCancel(s)}
									>annuler</button
								>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</div>
	</section>
</div>
