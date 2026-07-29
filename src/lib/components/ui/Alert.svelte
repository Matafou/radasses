<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'error' | 'warning';

	let {
		children,
		tone = 'error',
		class: className = ''
	}: {
		children: Snippet;
		tone?: Tone;
		class?: string;
	} = $props();

	const tones: Record<Tone, string> = {
		error: 'bg-red-50 text-red-700',
		warning: 'bg-amber-50 text-amber-700'
	};
</script>

<p class="rounded-lg p-3 text-sm {tones[tone]} {className}">
	{@render children()}
</p>
