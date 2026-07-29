<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { createTrip, redeemToken } from '$lib/auth';
	import { getTrip } from '$lib/db';
	import { getKnownTrips, rememberTrip, type KnownTrip } from '$lib/trips-store';

	let tripName = $state('');
	let myName = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let joining = $state(false);
	let known = $state<KnownTrip[]>([]);

	onMount(async () => {
		known = getKnownTrips();
		const token = $page.url.searchParams.get('token');
		if (token) {
			joining = true;
			try {
				const tripId = await redeemToken(token);
				const trip = await getTrip(tripId);
				rememberTrip({ id: tripId, name: trip?.name ?? 'Séjour' });
				await goto(`/t/${tripId}`);
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
				joining = false;
			}
		}
	});

	async function onCreate(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		if (!tripName.trim() || !myName.trim()) {
			error = 'Renseigne le nom du séjour et ton nom.';
			return;
		}
		busy = true;
		try {
			const res = await createTrip({ name: tripName.trim(), myName: myName.trim() });
			rememberTrip({ id: res.trip_id, name: tripName.trim() });
			await goto(`/t/${res.trip_id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="min-h-0 flex-1 overflow-y-auto p-4">
{#if joining}
	<p class="text-slate-500">Connexion au séjour…</p>
{:else}
	<section class="space-y-4">
		<h1 class="text-xl font-semibold">Nouveau séjour</h1>
		<form class="space-y-3" onsubmit={onCreate}>
			<label class="block">
				<span class="text-sm text-slate-600">Nom du séjour</span>
				<input
					class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
					bind:value={tripName}
					placeholder="Été à la mer"
				/>
			</label>
			<label class="block">
				<span class="text-sm text-slate-600">Ton prénom</span>
				<input
					class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
					bind:value={myName}
					placeholder="Alice"
				/>
			</label>
			{#if error}
				<p class="text-sm text-red-600">{error}</p>
			{/if}
			<button
				class="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
				disabled={busy}
			>
				{busy ? 'Création…' : 'Créer le séjour'}
			</button>
		</form>
	</section>

	{#if known.length}
		<section class="mt-8 space-y-2">
			<h2 class="text-sm font-medium text-slate-500">Mes séjours</h2>
			<ul class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
				{#each known as t (t.id)}
					<li>
						<a class="block px-4 py-3 hover:bg-slate-50" href={`/t/${t.id}`}>{t.name}</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}
</div>
