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

<ul
	class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white {className}"
>
	{@render children()}
</ul>
