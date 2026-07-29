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
	let addNotice = $state<string | null>(null);
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
		const name = newName.trim();
		if (!name) return void (addError = 'Nom requis.');
		adding = true;
		try {
			const hadExpenses = tripState.expenses.length > 0;
			await tripState.newParticipant({
				person_name: name,
				household_id: newHousehold === '__new__' ? null : newHousehold
			});
			newName = '';
			newHousehold = '__new__';
			showAdd = false;
			addNotice = hadExpenses
				? `Attention : les dépenses déjà enregistrées ne concernent pas ${name}.`
				: null;
		} catch (err) {
			addError = err instanceof Error ? err.message : String(err);
		} finally {
			adding = false;
		}
	}

	async function onToggleActive(p: Participant) {
		try {
			await tripState.setActive(p.participant_id, !p.active);
		} catch (err) {
			tripState.error = err instanceof Error ? err.message : String(err);
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
	<p class="text-xs text-slate-400">
		Un membre « parti » reste dans le séjour, mais n'est plus coché par défaut dans les nouvelles dépenses.
	</p>

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

	{#if addNotice}
		<p class="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">{addNotice}</p>
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
					<div class="flex items-center justify-between gap-2">
						<span class:text-slate-400={!p.active}>
							{p.person_name}
							{#if !p.active}<span class="text-xs text-slate-400">(parti)</span>{/if}
							<span class="text-xs text-slate-400">· {p.household_name}</span>
						</span>
						<div class="flex shrink-0 items-center gap-2">
							<span class="flex items-center gap-1.5 text-xs {p.active ? 'text-emerald-700' : 'text-slate-400'}">
								{p.active ? 'présent' : 'parti'}
								<button
									type="button"
									role="switch"
									aria-checked={p.active}
									aria-label={p.active ? 'Présent (basculer sur parti)' : 'Parti (basculer sur présent)'}
									onclick={() => onToggleActive(p)}
									class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {p.active
										? 'bg-emerald-600'
										: 'bg-slate-300'}"
								>
									<span
										class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {p.active
											? 'translate-x-4'
											: 'translate-x-0.5'}"
									></span>
								</button>
							</span>
							<button
								type="button"
								aria-label="Modifier"
								title="Modifier"
								class="inline-flex items-center rounded-md bg-amber-600 p-1 text-white hover:bg-amber-700"
								onclick={() => startEdit(p)}
							>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
									<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
								</svg>
							</button>
							<button
								type="button"
								aria-label="Copier le lien d'invitation"
								title="Copier le lien d'invitation"
								class="inline-flex items-center rounded-md border border-slate-300 p-1 text-slate-600 hover:bg-slate-50"
								onclick={() => copyLink(p.invite_token)}
							>
								{#if copied === p.invite_token}
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4 text-emerald-600">
										<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
									</svg>
								{/if}
							</button>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</section>
