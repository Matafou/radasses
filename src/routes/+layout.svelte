<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { backend } from '$lib/backend';
	import { errMessage } from '$lib/util';
	import { online } from '$lib/online.svelte';
	import { outbox } from '$lib/outbox.svelte';
	import { toast } from '$lib/toast.svelte';
	import { Alert, AppShell, LoadingText } from '$lib/components/ui';

	// Support de test (DEV uniquement — éliminé du build de prod par `import.meta.env.DEV`) :
	// expose le backend pour la vérif de parité du fold (e2e/fold-parity.spec.ts).
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		(window as unknown as Record<string, unknown>).__backend = backend;
	}

	let { children } = $props();
	let ready = $state(false);
	let error = $state<string | null>(null);
	// Hors-ligne au TOUT premier lancement (jamais venu) : pas de session en cache et
	// `signInAnonymously` (réseau) échoue → on distingue ce cas d'une vraie erreur.
	let offline = $state(false);
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
			else error = errMessage(e);
		}
	}

	onMount(async () => {
		await bootstrap();
		// L'outbox reste HORS du chemin critique : si IndexedDB est lent/bloqué, le démarrage
		// n'est pas figé. Une fois la file chargée, on rejoue d'éventuelles écritures laissées.
		void outbox.init().then(() => {
			if (online.current) void outbox.flush();
		});
	});

	// Retente le démarrage à la reconnexion si on n'a pas encore de session (cas
	// « jamais venu hors-ligne »). On saute la 1re exécution (déjà couverte par onMount).
	let started = false;
	$effect(() => {
		const isOnline = online.current;
		if (!started) {
			started = true;
			return;
		}
		if (isOnline && !ready) bootstrap();
	});
</script>

<AppShell showHeader={!tripId}>
	{#if !online.current && ready}
		<Alert tone="warning" class="m-2">
			Hors-ligne — ajouts et suppressions enregistrés{outbox.count > 0
				? ` (${outbox.count} en attente)`
				: ''}, synchronisés au retour. Les modifications sont désactivées.
		</Alert>
	{:else if online.current && outbox.count > 0 && ready}
		<Alert tone="warning" class="m-2">Synchronisation de {outbox.count} modification(s)…</Alert>
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

{#if toast.message}
	<div class="pointer-events-none fixed inset-x-0 bottom-6 z-(--z-toast) flex justify-center px-4">
		<p role="status" class="rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">
			{toast.message}
		</p>
	</div>
{/if}
