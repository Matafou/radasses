<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { backend } from '$lib/backend';
	import { getKnownTrips, rememberTrip, type KnownTrip } from '$lib/trips-store';
	import { autofocusWithin } from '$lib/actions/autofocus';
	import type { JoinCandidate } from '$lib/backend';
	import {
		Alert,
		Button,
		Card,
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

	// Rejoindre via le lien de SÉJOUR (« Qui es-tu ? ») — distinct du lien par
	// participant (?token=, auto-rattaché). Ici l'utilisateur choisit son nom.
	let joinToken = $state<string | null>(null);
	let candidates = $state<JoinCandidate[]>([]);
	let loadingCandidates = $state(false);
	let chosen = $state<JoinCandidate | null>(null); // identité en cours de confirmation
	let claiming = $state(false);

	onMount(async () => {
		known = getKnownTrips();

		const join = $page.url.searchParams.get('join');
		if (join) {
			joinToken = join;
			loadingCandidates = true;
			try {
				candidates = await backend.listJoinCandidates(join);
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
			} finally {
				loadingCandidates = false;
			}
			return;
		}

		const token = $page.url.searchParams.get('token');
		if (token) {
			joining = true;
			try {
				const tripId = await backend.redeemToken(token);
				const trip = await backend.getTrip(tripId);
				rememberTrip({ id: tripId, name: trip?.name ?? 'Séjour' });
				await goto(resolve('/t/[tripId]', { tripId }));
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
				joining = false;
			}
		}
	});

	async function confirmClaim() {
		if (!chosen || !joinToken) return;
		claiming = true;
		error = null;
		try {
			const tripId = await backend.claimParticipant(joinToken, chosen.participant_id);
			const trip = await backend.getTrip(tripId);
			rememberTrip({ id: tripId, name: trip?.name ?? 'Séjour' });
			await goto(resolve('/t/[tripId]', { tripId }));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			claiming = false;
		}
	}

	async function onCreate(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		if (!tripName.trim() || !myName.trim()) {
			error = 'Renseigne le nom du séjour et ton nom.';
			return;
		}
		busy = true;
		try {
			const res = await backend.createTrip({ name: tripName.trim(), myName: myName.trim() });
			rememberTrip({ id: res.trip_id, name: tripName.trim() });
			await goto(resolve('/t/[tripId]', { tripId: res.trip_id }));
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
	{:else if joinToken}
		<!-- Rejoindre via le lien de séjour : choisir son nom dans la liste. -->
		<section class="space-y-4">
			<h1 class="text-xl font-semibold">Qui es-tu ?</h1>
			{#if loadingCandidates}
				<LoadingText text="Chargement des participants…" class="text-slate-500" />
			{:else if chosen}
				<Card>
					<div class="space-y-3">
						<p class="text-sm">
							C'est bien toi, <strong>{chosen.person_name}</strong> ?
							{#if chosen.claimed}
								<span class="text-slate-500">(cette identité a déjà été prise au moins une fois)</span>
							{/if}
						</p>
						{#if error}
							<FieldError>{error}</FieldError>
						{/if}
						<div class="flex gap-2">
							<Button disabled={claiming} onclick={confirmClaim}>
								{claiming ? 'Connexion…' : `Oui, c'est moi`}
							</Button>
							<Button variant="secondary" disabled={claiming} onclick={() => (chosen = null)}>
								Non
							</Button>
						</div>
					</div>
				</Card>
			{:else if candidates.length}
				<p class="text-sm text-slate-500">Choisis ton nom pour rejoindre le séjour.</p>
				<PanelList>
					{#each candidates as c (c.participant_id)}
						<ListRow class="p-0">
							<button
								type="button"
								class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
								onclick={() => {
									error = null;
									chosen = c;
								}}
							>
								<span>{c.person_name}</span>
								{#if c.claimed}<span class="text-xs text-slate-400">déjà pris</span>{/if}
							</button>
						</ListRow>
					{/each}
				</PanelList>
			{:else}
				<Alert tone="warning">
					{error ?? 'Ce lien de séjour est invalide ou ne comporte aucun participant.'}
				</Alert>
			{/if}
		</section>
	{:else}
		<section class="space-y-4">
			<h1 class="text-xl font-semibold">Nouveau séjour</h1>
			<form class="space-y-3" onsubmit={onCreate} use:autofocusWithin>
				<label class="block">
					<span class="inline-form-label">Nom du séjour</span>
					<TextInput
						class="mt-1 w-full"
						bind:value={tripName}
						placeholder="Été à la mer"
						data-autofocus
					/>
				</label>
				<label class="block">
					<span class="inline-form-label">Ton prénom</span>
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
							<a
								class="block px-4 py-3 hover:bg-slate-50"
								href={resolve('/t/[tripId]', { tripId: t.id })}>{t.name}</a
							>
						</ListRow>
					{/each}
				</PanelList>
			</section>
		{/if}
	{/if}
</div>
