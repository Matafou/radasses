<script lang="ts">
	import { base } from '$app/paths';
	import { getTripState } from '$lib/trip.svelte';
	import type { Participant } from '$lib/db';

	const tripState = getTripState();

	// ajout
	let showAdd = $state(false);
	let newName = $state('');
	let newHousehold = $state('__new__');
	let adding = $state(false);
	let addError = $state<string | null>(null);
	let copied = $state<string | null>(null);

	// édition
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editHousehold = $state('');
	let saving = $state(false);
	let editError = $state<string | null>(null);

	function inviteLink(token: string): string {
		const origin = typeof location !== 'undefined' ? location.origin : '';
		return `${origin}${base}/?token=${token}`;
	}
	async function copyLink(token: string) {
		try {
			await navigator.clipboard.writeText(inviteLink(token));
			copied = token;
			setTimeout(() => (copied = null), 1500);
		} catch {
			/* clipboard indispo */
		}
	}

	async function onAdd(e: SubmitEvent) {
		e.preventDefault();
		addError = null;
		if (!newName.trim()) return void (addError = 'Nom requis.');
		adding = true;
		try {
			await tripState.newParticipant({
				person_name: newName.trim(),
				household_id: newHousehold === '__new__' ? null : newHousehold
			});
			newName = '';
			newHousehold = '__new__';
			showAdd = false;
		} catch (err) {
			addError = err instanceof Error ? err.message : String(err);
		} finally {
			adding = false;
		}
	}

	function startEdit(p: Participant) {
		editingId = p.participant_id;
		editName = p.person_name;
		editHousehold = p.household_name;
		editError = null;
	}
	async function onSaveEdit(p: Participant) {
		editError = null;
		if (!editName.trim() || !editHousehold.trim()) return void (editError = 'Nom et foyer requis.');
		saving = true;
		try {
			await tripState.renameParticipant({
				person_id: p.person_id,
				person_name: editName.trim(),
				household_id: p.household_id,
				household_name: editHousehold.trim()
			});
			editingId = null;
		} catch (err) {
			editError = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<section class="space-y-2">
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-medium text-slate-500">Participants</h2>
		<button class="text-sm text-slate-700 underline" onclick={() => (showAdd = !showAdd)}>
			{showAdd ? 'annuler' : '+ ajouter'}
		</button>
	</div>

	{#if showAdd}
		<form class="space-y-2 rounded-lg border border-slate-200 bg-white p-3" onsubmit={onAdd}>
			<input class="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Prénom" bind:value={newName} />
			<label class="block text-sm text-slate-600">
				Foyer
				<select class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" bind:value={newHousehold}>
					<option value="__new__">Nouveau foyer (cette personne seule)</option>
					{#each tripState.households as h (h.id)}
						<option value={h.id}>Rejoindre : {h.name}</option>
					{/each}
				</select>
			</label>
			{#if addError}
				<p class="text-sm text-red-600">{addError}</p>
			{/if}
			<button class="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={adding}>
				{adding ? 'Ajout…' : 'Ajouter'}
			</button>
		</form>
	{/if}

	<ul class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
		{#each tripState.participants as p (p.participant_id)}
			<li class="px-4 py-3">
				{#if editingId === p.participant_id}
					<div class="space-y-2">
						<label class="block text-xs text-slate-500">
							Prénom
							<input class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" bind:value={editName} />
						</label>
						<label class="block text-xs text-slate-500">
							Foyer <span class="text-slate-400">(partagé : renomme pour tous ses membres)</span>
							<input class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" bind:value={editHousehold} />
						</label>
						{#if editError}
							<p class="text-sm text-red-600">{editError}</p>
						{/if}
						<div class="flex gap-2">
							<button class="rounded-md bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={saving} onclick={() => onSaveEdit(p)}>
								{saving ? '…' : 'Enregistrer'}
							</button>
							<button class="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600" onclick={() => (editingId = null)}>Annuler</button>
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-between">
						<span>{p.person_name} <span class="text-xs text-slate-400">· {p.household_name}</span></span>
						<div class="flex gap-2">
							<button class="text-xs text-slate-500 underline" onclick={() => startEdit(p)}>modifier</button>
							<button class="text-xs text-slate-500 underline" onclick={() => copyLink(p.invite_token)}>
								{copied === p.invite_token ? 'copié ✓' : 'lien'}
							</button>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</section>
