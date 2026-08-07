<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { getTripState } from '$lib/trip.svelte';
	import { foyerLabel } from '$lib/format';
	import BalanceLedger from '$lib/components/BalanceLedger.svelte';
	import { MetaText } from '$lib/components/ui';

	const tripState = getTripState();
	const householdId = $derived($page.params.householdId!);
	const name = $derived(tripState.householdName.get(householdId));
	const members = $derived(
		tripState.participants.filter((p) => p.household_id === householdId)
	);
	const memberIds = $derived(members.map((p) => p.person_id));
</script>

<div class="space-y-4">
	{#if name}
		<div>
			<h1 class="text-xl font-semibold first-letter:uppercase">{foyerLabel(name)}</h1>
			<MetaText>
				Foyer ·
				{#each members as p, i (p.person_id)}
					{i > 0 ? ' · ' : ''}<a
						class="hover:underline"
						href={resolve('/t/[tripId]/personne/[personId]', {
							tripId: tripState.tripId,
							personId: p.person_id
						})}>{p.person_name}</a
					>
				{/each}
			</MetaText>
		</div>

		<BalanceLedger personIds={memberIds} subjectName={foyerLabel(name)} />

		<p class="text-xs text-slate-400">
			Le solde d'un foyer est ce qu'il doit ou ce qu'on lui doit ; les remboursements se règlent à
			ce niveau.
		</p>
	{:else}
		<p class="text-sm text-slate-400">Foyer introuvable.</p>
	{/if}
</div>
