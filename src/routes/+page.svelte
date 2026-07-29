<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { createTrip, redeemToken } from '$lib/auth';
	import { getTrip } from '$lib/db';
	import { getKnownTrips, rememberTrip, type KnownTrip } from '$lib/trips-store';
	import {
		Button,
		FieldError,
		LoadingText,
		ListRow,
		PanelList,
		SectionHeader,
		TextInput
	} from '$lib/components/ui';

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
		<LoadingText text="Connexion au séjour…" class="text-slate-500" />
	{:else}
		<section class="space-y-4">
			<h1 class="text-xl font-semibold">Nouveau séjour</h1>
			<form class="space-y-3" onsubmit={onCreate}>
				<label class="block">
					<span class="text-sm text-slate-600">Nom du séjour</span>
					<TextInput class="mt-1 w-full" bind:value={tripName} placeholder="Été à la mer" />
				</label>
				<label class="block">
					<span class="text-sm text-slate-600">Ton prénom</span>
					<TextInput class="mt-1 w-full" bind:value={myName} placeholder="Alice" />
				</label>
				{#if error}
					<FieldError>{error}</FieldError>
				{/if}
				<Button type="submit" class="w-full" disabled={busy}>
					{busy ? 'Création…' : 'Créer le séjour'}
				</Button>
			</form>
		</section>

		{#if known.length}
			<section class="mt-8 space-y-2">
				<SectionHeader title="Mes séjours" />
				<PanelList>
					{#each known as t (t.id)}
						<ListRow class="p-0">
							<a class="block px-4 py-3 hover:bg-slate-50" href={`/t/${t.id}`}>{t.name}</a>
						</ListRow>
					{/each}
				</PanelList>
			</section>
		{/if}
	{/if}
</div>
