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
		...rest
	}: {
		icon: Component;
		label: string;
		variant?: Variant;
		size?: number;
		class?: string;
		type?: 'button' | 'submit' | 'reset';
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
	class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg {variants[
		variant
	]} {className}"
	{...rest}
>
	<Icon {size} strokeWidth={2.25} aria-hidden="true" />
</button>
