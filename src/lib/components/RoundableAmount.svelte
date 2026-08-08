<script lang="ts">
	// Montant affiché ARRONDI quand l'option d'appareil est active (Réglages) : la
	// valeur EXACTE apparaît au survol (infobulle `title`) et à l'appui (tap → bascule,
	// re-tap → ré-arrondi). Le soulignement pointillé signale que c'est « dépliable ».
	// Sans l'option, on affiche simplement l'exact (aucune interaction).
	import { money, moneyRounded } from '$lib/format';
	import { prefs } from '$lib/prefs.svelte';

	let {
		cents,
		currency = 'EUR',
		class: className = ''
	}: { cents: number; currency?: string; class?: string } = $props();

	let revealed = $state(false);
	const exact = $derived(money(cents, currency));
	const rounded = $derived(moneyRounded(cents, currency));
</script>

{#if prefs.roundAmounts}
	<button
		type="button"
		class="pointer-events-auto cursor-help p-0 tabular-nums underline decoration-dotted underline-offset-2 {className}"
		title={exact}
		aria-label={`${rounded} (montant exact : ${exact})`}
		onclick={(e) => {
			// Ne pas déclencher une éventuelle navigation de la ligne parente.
			e.stopPropagation();
			e.preventDefault();
			revealed = !revealed;
		}}
	>{revealed ? exact : rounded}</button>
{:else}
	<span class="tabular-nums {className}">{exact}</span>
{/if}
