<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { backend } from '$lib/backend';
	import { Alert, AppShell, LoadingText } from '$lib/components/ui';

	let { children } = $props();
	let ready = $state(false);
	let error = $state<string | null>(null);
	// Hors-ligne au TOUT premier lancement (jamais venu) : pas de session en cache et
	// `signInAnonymously` (réseau) échoue → on distingue ce cas d'une vraie erreur.
	let offline = $state(false);
	// État de connexion courant (pour la bannière). `navigator.onLine` n'est fiable
	// qu'après le montage (SSR off, mais prudence).
	let online = $state(true);
	// Sur une route de séjour, c'est le layout du séjour qui fournit sa propre
	// barre du haut (retour + titre + réglages) → on masque l'en-tête « Radasses ».
	let tripId = $derived($page.params.tripId);

	async function bootstrap() {
		try {
			await backend.ensureSession(); // session anonyme (sans écran de login)
			ready = true;
			offline = false;
			error = null;
		} catch (e) {
			// Hors-ligne + jamais venu → message dédié ; sinon vraie erreur.
			if (!navigator.onLine) offline = true;
			else error = e instanceof Error ? e.message : String(e);
		}
	}

	onMount(bootstrap);

	// Écoute la connexion : met à jour la bannière et retente le démarrage à la
	// reconnexion si on n'a pas encore de session (cas « jamais venu hors-ligne »).
	$effect(() => {
		online = navigator.onLine;
		const on = () => {
			online = true;
			if (!ready) bootstrap();
		};
		const off = () => (online = false);
		window.addEventListener('online', on);
		window.addEventListener('offline', off);
		return () => {
			window.removeEventListener('online', on);
			window.removeEventListener('offline', off);
		};
	});
</script>

<AppShell showHeader={!tripId}>
	{#if !online && ready}
		<Alert tone="warning" class="m-2">Hors-ligne — reconnecte-toi pour charger les données.</Alert>
	{/if}
	{#if error}
		<Alert class="m-4">Erreur : {error}</Alert>
	{:else if offline && !ready}
		<Alert tone="warning" class="m-4">
			Tu es hors-ligne. Connecte-toi à Internet une première fois pour ouvrir radasses ; ensuite
			l'appli se lancera aussi hors-ligne.
		</Alert>
	{:else if !ready}
		<LoadingText class="p-4" />
	{:else}
		{@render children()}
	{/if}
</AppShell>
