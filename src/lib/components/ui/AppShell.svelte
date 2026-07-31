<script lang="ts">
	import { base, resolve } from '$app/paths';
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
		<header class="flex-none border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
			<div class="relative mx-auto flex h-(--bar-h) w-full max-w-app items-center px-4">
				<!-- Même disposition que la barre d'un séjour : favicon centré (absolu →
				     n'affecte pas la hauteur), titre à droite. -->
				<img
					src="{base}/favicon.png"
					alt=""
					aria-hidden="true"
					class="pointer-events-none absolute top-1/2 left-1/2 h-(--bar-h) w-(--bar-h) -translate-x-1/2 -translate-y-1/2"
				/>
				<a href={resolve('/')} class="relative ml-auto text-lg font-semibold tracking-tight"
					>Radasses</a
				>
			</div>
		</header>
	{/if}

	<main class="mx-auto flex min-h-0 w-full max-w-app flex-1 flex-col">
		{@render children()}
	</main>
</div>
