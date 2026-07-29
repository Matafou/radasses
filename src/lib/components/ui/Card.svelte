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

<div class="rounded-lg border border-slate-200 bg-white p-3 {className}">
	{@render children()}
</div>
