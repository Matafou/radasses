<script lang="ts">
	import { getTripState } from '$lib/trip.svelte';
	import type { Settlement } from '$lib/db';
	import type { Transfer } from '$lib/settlements';
	import { money } from '$lib/format';

	const tripState = getTripState();
	const fmt = (c: number) => money(c, tripState.currency);

	// Un remboursement = une dépense : le débiteur « paie » le créditeur.
	// On préremplit le formulaire de dépense (bottom-sheet du layout) pour ajuster/valider.
	function onReimburse(t: Transfer) {
		const from = tripState.participants.find((p) => p.household_id === t.from_household_id)?.person_id;
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

<div class="flex h-[calc(100dvh-13rem)] flex-col gap-4">
	<!-- Soldes par foyer : moitié haute, liste scrollable -->
	<section class="flex min-h-0 flex-1 flex-col">
		<h2 class="mb-2 text-sm font-medium text-slate-500">Soldes par foyer</h2>
		<ul class="flex-1 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-white">
			{#each tripState.balances as b (b.household_id)}
				<li class="flex items-center justify-between px-4 py-3">
					<span>{tripState.householdName.get(b.household_id) ?? '?'}</span>
					<span
						class={b.net_cents > 0 ? 'font-medium text-emerald-600'
							: b.net_cents < 0 ? 'font-medium text-red-600' : 'text-slate-400'}
					>
						{b.net_cents > 0 ? '+' : ''}{fmt(b.net_cents)}
						<span class="ml-1 text-xs text-slate-400">
							{b.net_cents > 0 ? 'on lui doit' : b.net_cents < 0 ? 'doit' : ''}
						</span>
					</span>
				</li>
			{:else}
				<li class="px-4 py-3 text-sm text-slate-400">Aucun solde.</li>
			{/each}
		</ul>
	</section>

	<!-- Remboursements : moitié basse ; bouton manuel en tête, le reste scrollable -->
	<section class="flex min-h-0 flex-1 flex-col">
		<h2 class="mb-2 text-sm font-medium text-slate-500">Remboursements</h2>
		<button
			type="button"
			class="mb-2 w-full rounded-lg border border-dashed border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
			onclick={() => tripState.openReimbursement()}
		>
			+ signaler un remboursement
		</button>
		<div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
			<p class="text-xs text-slate-400">
				Le bouton <span class="inline-flex items-center rounded bg-emerald-600 px-1 font-medium text-white" aria-hidden="true">✓</span>
				confirme un remboursement en créant la dépense correspondante.
			</p>
			{#if tripState.transfers.length}
				<ul class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
					{#each tripState.transfers as t (t.from_household_id + t.to_household_id)}
						<li class="flex items-center justify-between gap-2 px-4 py-3 text-sm">
							<span>
								<span class="font-medium">{tripState.householdName.get(t.from_household_id) ?? '?'}</span>
								→ <span class="font-medium">{tripState.householdName.get(t.to_household_id) ?? '?'}</span>
								: {fmt(t.amount_cents)}
							</span>
							<button class="shrink-0 whitespace-nowrap rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white" onclick={() => onReimburse(t)}>
								<span aria-hidden="true">✓</span> Remboursé !
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="rounded-lg border border-dashed border-slate-200 p-3 text-center text-sm text-slate-400">
					Tout est équilibré 🎉
				</p>
			{/if}

			{#if tripState.settlements.length}
				<details class="rounded-lg border border-slate-200 bg-white p-3">
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
								<button class="text-xs text-red-500 underline" onclick={() => onCancel(s)}>annuler</button>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</div>
	</section>
</div>
