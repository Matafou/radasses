<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { ensureSession } from '$lib/auth';

	let { children } = $props();
	let ready = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			await ensureSession(); // session anonyme (sans écran de login)
			ready = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-dvh bg-slate-50 text-slate-900">
	<header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
		<div class="mx-auto flex max-w-md items-center px-4 py-3">
			<a href="/" class="text-lg font-semibold tracking-tight">Radasses</a>
			<span class="ml-2 text-sm text-slate-400">dépenses entre amis</span>
		</div>
	</header>

	<main class="mx-auto max-w-md p-4">
		{#if error}
			<p class="rounded-lg bg-red-50 p-3 text-sm text-red-700">Erreur : {error}</p>
		{:else if !ready}
			<p class="text-slate-400">Chargement…</p>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>
