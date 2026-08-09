<script lang="ts">
	import type { Component } from 'svelte';

	type Variant = 'ghost' | 'outline' | 'success' | 'warning' | 'danger';

	let {
		icon,
		label,
		variant = 'ghost',
		size = 16,
		type = 'button',
		title = label,
		class: className = '',
		muted = false,
		...rest
	}: {
		icon: Component;
		label: string;
		variant?: Variant;
		size?: number;
		type?: 'button' | 'submit' | 'reset';
		title?: string;
		class?: string;
		/** grisé mais TOUJOURS cliquable (action indisponible hors-ligne qui signale au tap) */
		muted?: boolean;
		[key: string]: unknown;
	} = $props();

	const variants: Record<Variant, string> = {
		ghost: 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
		outline: 'border border-slate-300 text-slate-600 hover:bg-slate-50',
		success: 'bg-green-600 text-white hover:bg-green-700',
		warning: 'bg-amber-600 text-white hover:bg-amber-700',
		danger: 'bg-red-600 text-white hover:bg-red-700'
	};
	let Icon = $derived(icon);
</script>

<button
	{type}
	aria-label={label}
	{title}
	class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md disabled:opacity-40 disabled:pointer-events-none {muted
		? 'cursor-not-allowed bg-slate-100 text-slate-300'
		: variants[variant]} {className}"
	{...rest}
>
	<!-- Taille d'icône en `em` (relative à la police du bouton) → elle suit le
	     bouton quand le texte est agrandi. `size/16` = même rendu qu'avant à 16px. -->
	<Icon strokeWidth={2} aria-hidden="true" style="width:{size / 16}em;height:{size / 16}em" />
</button>
