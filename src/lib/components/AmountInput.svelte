<script lang="ts">
	// Champ de saisie d'un montant, mutualisé entre ExpenseForm et
	// ReimbursementForm. Bake le placeholder « Montant € » + `inputmode="decimal"`
	// (clavier numérique mobile). La valeur reste une CHAÎNE (parsée par
	// `centsFromEuros` côté formulaire) ; la largeur se passe via `class`.
	import { TextInput } from '$lib/components/ui';

	let {
		value = $bindable(''),
		class: className = '',
		...rest
	}: {
		value?: string;
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<TextInput placeholder="Montant €" inputmode="decimal" bind:value class={className} {...rest} />
