<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let {
		children,
		showHeader = true
	}: {
		children: Snippet;
		showHeader?: boolean;
	} = $props();
</script>

<div class="flex h-dvh flex-col bg-slate-50 text-slate-900">
	{#if showHeader}
		<header class="flex-none border-b border-slate-200 bg-white">
			<div class="mx-auto flex max-w-app items-center px-4 py-3">
				<a href={resolve('/')} class="text-lg font-semibold tracking-tight">Radasses</a>
			</div>
		</header>
	{/if}

	<main class="mx-auto flex min-h-0 w-full max-w-app flex-1 flex-col">
		{@render children()}
	</main>
</div>
