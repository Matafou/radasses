<script lang="ts">
	import { page } from '$app/stores';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowLeft } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import BalanceLedger from '$lib/components/BalanceLedger.svelte';
	import { MetaText } from '$lib/components/ui';

	const tripState = getTripState();
	const personId = $derived($page.params.personId!);
	const participant = $derived(tripState.participants.find((p) => p.person_id === personId));
</script>

<div class="space-y-4">
	<button
		type="button"
		class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
		onclick={() => history.back()}
	>
		<ArrowLeft size={16} aria-hidden="true" /> Retour
	</button>

	{#if participant}
		<div>
			<h1 class="text-xl font-semibold" class:text-slate-400={!participant.active}>
				{participant.person_name}
				{#if !participant.active}<MetaText>(parti)</MetaText>{/if}
			</h1>
			<MetaText>Foyer : {participant.household_name}</MetaText>
		</div>

		<BalanceLedger personIds={[personId]} />

		<p class="text-xs text-slate-400">
			Détail indicatif : les remboursements se règlent par <strong>foyer</strong>, pas par personne.
		</p>
	{:else}
		<p class="text-sm text-slate-400">Participant introuvable.</p>
	{/if}
</div>
