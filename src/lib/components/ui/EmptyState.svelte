<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = ''
	}: {
		children: Snippet;
		class?: string;
	} = $props();
</script>

<div
	class="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400 {className}"
>
	{@render children()}
</div>
