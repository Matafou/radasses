<script lang="ts">
	import { page } from '$app/stores';
	import { getTripState } from '$lib/trip.svelte';
	import BalanceLedger from '$lib/components/BalanceLedger.svelte';
	import { MetaText } from '$lib/components/ui';

	const tripState = getTripState();
	const personId = $derived($page.params.personId!);
	const participant = $derived(tripState.participants.find((p) => p.person_id === personId));
</script>

<div class="space-y-4">
	{#if participant}
		<div>
			<h1 class="text-xl font-semibold" class:text-slate-400={!participant.active}>
				{participant.person_name}
				{#if !participant.active}<MetaText>(parti)</MetaText>{/if}
			</h1>
			<MetaText>Foyer : {participant.household_name}</MetaText>
		</div>

		<BalanceLedger personIds={[personId]} subjectName={participant.person_name} />

		<p class="text-xs text-slate-400">
			Détail indicatif : les remboursements se règlent par <strong>foyer</strong>, pas par personne.
		</p>
	{:else}
		<p class="text-sm text-slate-400">Participant introuvable.</p>
	{/if}
</div>
