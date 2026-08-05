<script lang="ts">
	// Menu déroulant de choix d'un participant (par `person_id`), mutualisé entre
	// « Payé par » (ExpenseForm) et « Qui rembourse » / « Qui est remboursé »
	// (ReimbursementForm). Lit les participants du séjour courant.
	import { getTripState } from '$lib/trip.svelte';
	import { Select } from '$lib/components/ui';

	let {
		value = $bindable(''),
		placeholder = null,
		showInactiveTag = false,
		class: className = '',
		...rest
	}: {
		value?: string;
		/** Si fourni, ajoute une 1re option vide (value="") avec ce libellé (ex. « — »). */
		placeholder?: string | null;
		/** Suffixer les participants « partis » d'un « (parti) ». */
		showInactiveTag?: boolean;
		class?: string;
		[key: string]: unknown;
	} = $props();

	const tripState = getTripState();
</script>

<Select bind:value class={className} {...rest}>
	{#if placeholder != null}
		<option value="">{placeholder}</option>
	{/if}
	{#each tripState.participants as p (p.person_id)}
		<option value={p.person_id}
			>{p.person_name}{showInactiveTag && !p.active ? ' (parti)' : ''}</option
		>
	{/each}
</Select>
