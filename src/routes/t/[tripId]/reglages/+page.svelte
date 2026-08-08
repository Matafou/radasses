<script lang="ts">
	import { resolve } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ChevronRight, History, UserRound } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import { online } from '$lib/online.svelte';
	import { foyerLabel } from '$lib/format';
	import { prefs } from '$lib/prefs.svelte';
	import { autofocusWithin } from '$lib/actions/autofocus';
	import {
		Button,
		Card,
		FieldError,
		SectionHeader,
		Select,
		Switch,
		TextInput
	} from '$lib/components/ui';

	const tripState = getTripState();

	// « Qui suis-je ? » : le participant auquel la session courante est rattachée
	// (utile depuis le lien de séjour où l'on « choisit son nom »).
	const me = $derived(
		tripState.participants.find((p) => p.person_id === tripState.myPersonId) ?? null
	);

	let name = $state(tripState.trip?.name ?? '');
	let currency = $state(tripState.trip?.currency ?? 'EUR');
	let saving = $state(false);
	let saved = $state(false);
	let error = $state<string | null>(null);

	const base = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'SEK', 'AUD'];
	const currencies = $derived(base.includes(currency) ? base : [currency, ...base]);

	async function onSave(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		saved = false;
		if (!name.trim()) return void (error = 'Nom requis.');
		saving = true;
		try {
			await tripState.updateSettings({ name: name.trim(), currency });
			saved = true;
			setTimeout(() => (saved = false), 1500);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<section class="space-y-3">
	<SectionHeader title="Réglages du séjour" />

	<!-- Qui suis-je ? — identité de la session courante dans ce séjour. -->
	<Card>
		<div class="flex items-center gap-3">
			<UserRound size={20} class="shrink-0 text-slate-400" aria-hidden="true" />
			<div class="min-w-0 text-sm">
				<p class="text-xs text-slate-500">Qui suis-je ?</p>
				{#if me}
					<p class="truncate">
						<span class="font-medium">{me.person_name}</span>
						<span class="text-slate-500"> · {foyerLabel(me.household_name)}</span>
					</p>
				{:else}
					<p class="text-slate-400">Identité inconnue sur cet appareil.</p>
				{/if}
			</div>
		</div>
	</Card>

	<Card>
		<form class="space-y-3" onsubmit={onSave} use:autofocusWithin>
			<label class="form-label">
				Nom du séjour
				<TextInput class="mt-1 w-full" bind:value={name} data-autofocus />
			</label>
			<label class="form-label">
				Devise
				<Select class="mt-1 w-full" bind:value={currency}>
					{#each currencies as c (c)}
						<option value={c}>{c}</option>
					{/each}
				</Select>
			</label>
			{#if error}
				<FieldError>{error}</FieldError>
			{/if}
			<Button type="submit" class="w-full" disabled={saving || !online.current}>
				{saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
			</Button>
		</form>
	</Card>

	<!-- Préférence d'AFFICHAGE, propre à cet appareil (non partagée avec les membres). -->
	<Card>
		<div class="flex items-center justify-between gap-3">
			<div class="text-sm">
				<p>Arrondir les montants</p>
				<p class="text-xs text-slate-500">
					Soldes et remboursements à l'euro près (montant exact au survol / à l'appui). Réglage de
					cet appareil.
				</p>
			</div>
			<Switch
				checked={prefs.roundAmounts}
				label="Arrondir les montants"
				onclick={() => prefs.setRoundAmounts(!prefs.roundAmounts)}
			/>
		</div>
	</Card>

	<!-- Le Journal a quitté la barre d'onglets → on y accède ici. -->
	<a
		href={resolve('/t/[tripId]/journal', { tripId: tripState.tripId })}
		class="flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
	>
		<History size={18} class="shrink-0 text-slate-400" aria-hidden="true" />
		<span class="flex-1">Journal des opérations</span>
		<ChevronRight size={16} class="shrink-0 text-slate-400" aria-hidden="true" />
	</a>
</section>
