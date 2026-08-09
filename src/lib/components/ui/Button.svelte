<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'outline';
	type Size = 'sm' | 'md';

	let {
		children,
		variant = 'primary',
		size = 'md',
		type = 'button',
		class: className = '',
		disabled = false,
		muted = false,
		...rest
	}: {
		children: Snippet;
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		disabled?: boolean;
		/** grisé mais TOUJOURS cliquable (ex. action indisponible hors-ligne qui signale au tap) */
		muted?: boolean;
		[key: string]: unknown;
	} = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-slate-900 text-white hover:bg-slate-800',
		secondary: 'border border-slate-300 text-slate-600 hover:bg-slate-50',
		success: 'bg-emerald-600 text-white hover:bg-emerald-700',
		warning: 'bg-amber-600 text-white hover:bg-amber-700',
		danger: 'bg-red-600 text-white hover:bg-red-700',
		ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
		outline: 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
	};
	const sizes: Record<Size, string> = {
		sm: 'rounded-md px-3 py-1 text-sm',
		md: 'rounded-lg px-4 py-2 text-sm font-medium'
	};
</script>

<button
	{type}
	{disabled}
	class="inline-flex items-center justify-center gap-1.5 disabled:opacity-50 {sizes[size]} {muted
		? 'cursor-not-allowed bg-slate-200 text-slate-400'
		: variants[variant]} {className}"
	{...rest}
>
	{@render children()}
</button>
