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

<ul class="panel-surface divide-y divide-slate-200 overflow-hidden {className}">
	{@render children()}
</ul>
