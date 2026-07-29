<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		actions
	}: {
		title: string;
		description?: string;
		actions?: Snippet;
	} = $props();
</script>

<div class="flex items-start justify-between gap-2">
	<div class="space-y-1">
		<h2 class="text-sm font-medium text-slate-500">{title}</h2>
		{#if description}
			<p class="text-xs text-slate-400">{description}</p>
		{/if}
	</div>
	{#if actions}
		{@render actions()}
	{/if}
</div>
