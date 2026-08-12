<script lang="ts">
	import type { Component } from 'svelte';

	type Variant = 'success' | 'warning';

	let {
		icon,
		label,
		variant = 'success',
		size = 20,
		class: className = '',
		type = 'button',
		muted = false,
		...rest
	}: {
		icon: Component;
		label: string;
		variant?: Variant;
		size?: number;
		class?: string;
		type?: 'button' | 'submit' | 'reset';
		/** grisé mais TOUJOURS cliquable (action indisponible hors-ligne qui signale au tap) */
		muted?: boolean;
		[key: string]: unknown;
	} = $props();

	const variants: Record<Variant, string> = {
		success: 'bg-green-600 hover:bg-green-700',
		warning: 'bg-amber-600 hover:bg-amber-700'
	};
	let Icon = $derived(icon);
</script>

<button
	{type}
	aria-label={label}
	title={label}
	class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none {muted
		? 'cursor-not-allowed bg-slate-300 shadow-none'
		: variants[variant]} {className}"
	{...rest}
>
	<!-- Icône en `em` (suit le bouton quand le texte est agrandi ; `size/16` =
	     même rendu qu'avant à 16px). -->
	<Icon strokeWidth={2.25} aria-hidden="true" style="width:{size / 16}em;height:{size / 16}em" />
</button>
