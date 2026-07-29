<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { ensureSession } from '$lib/auth';
	import Alert from '$lib/components/ui/Alert.svelte';

	let { children } = $props();
	let ready = $state(false);
	let error = $state<string | null>(null);
	// Sur une route de séjour, c'est le layout du séjour qui fournit sa propre
	// barre du haut (retour + titre + réglages) → on masque l'en-tête « Radasses ».
	let tripId = $derived($page.params.tripId);

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

<div class="flex h-dvh flex-col bg-slate-50 text-slate-900">
	{#if !tripId}
		<header class="flex-none border-b border-slate-200 bg-white">
			<div class="mx-auto flex max-w-md items-center px-4 py-3">
				<a href="/" class="text-lg font-semibold tracking-tight">Radasses</a>
			</div>
		</header>
	{/if}

	<main class="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
		{#if error}
			<Alert class="m-4">Erreur : {error}</Alert>
		{:else if !ready}
			<p class="p-4 text-slate-400">Chargement…</p>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>
