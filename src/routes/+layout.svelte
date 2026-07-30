<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { backend } from '$lib/backend';
	import { Alert, AppShell, LoadingText } from '$lib/components/ui';

	let { children } = $props();
	let ready = $state(false);
	let error = $state<string | null>(null);
	// Sur une route de séjour, c'est le layout du séjour qui fournit sa propre
	// barre du haut (retour + titre + réglages) → on masque l'en-tête « Radasses ».
	let tripId = $derived($page.params.tripId);

	onMount(async () => {
		try {
			await backend.ensureSession(); // session anonyme (sans écran de login)
			ready = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<AppShell showHeader={!tripId}>
	{#if error}
		<Alert class="m-4">Erreur : {error}</Alert>
	{:else if !ready}
		<LoadingText class="p-4" />
	{:else}
		{@render children()}
	{/if}
</AppShell>
