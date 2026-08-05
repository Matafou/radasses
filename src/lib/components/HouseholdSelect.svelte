<script lang="ts">
	// Menu déroulant de choix d'un foyer, mutualisé entre l'ajout d'un participant
	// (« Rejoindre ») et son édition (« Déplacer vers »). La valeur est un
	// `household_id`, ou la sentinelle `__new__` = créer un nouveau foyer.
	import { getTripState } from '$lib/trip.svelte';
	import { Select } from '$lib/components/ui';

	let {
		value = $bindable('__new__'),
		newLabel = 'Nouveau foyer (cette personne seule)',
		optionPrefix = '',
		class: className = '',
		...rest
	}: {
		value?: string;
		/** Libellé de l'option « créer un nouveau foyer » (value `__new__`). */
		newLabel?: string;
		/** Préfixe devant chaque foyer existant (ex. « Rejoindre : »). */
		optionPrefix?: string;
		class?: string;
		[key: string]: unknown;
	} = $props();

	const tripState = getTripState();
</script>

<Select bind:value class={className} {...rest}>
	<option value="__new__">{newLabel}</option>
	{#each tripState.households as h (h.id)}
		<option value={h.id}>{optionPrefix}{h.name}</option>
	{/each}
</Select>
