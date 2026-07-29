<script lang="ts">
	import { base } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { Check, Link, Pencil, Plus, X } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import type { Participant } from '$lib/db';
	import {
		Alert,
		Button,
		Card,
		Fab,
		FieldError,
		IconButton,
		ListRow,
		MetaText,
		PanelList,
		SectionHeader,
		Select,
		Switch,
		TextInput
	} from '$lib/components/ui';

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

{#snippet addParticipantAction()}
	<Fab
		icon={showAdd ? X : Plus}
		label={showAdd ? 'Annuler l’ajout' : 'Ajouter un participant'}
		class="h-9 w-9 shadow"
		onclick={() => (showAdd = !showAdd)}
	/>
{/snippet}

<section class="space-y-2">
	<SectionHeader
		title="Participants"
		description="Un membre « parti » reste dans le séjour, mais n'est plus coché par défaut dans les nouvelles dépenses."
		actions={addParticipantAction}
	/>

	{#if showAdd}
		<Card>
			<form class="space-y-2" onsubmit={onAdd}>
				<TextInput class="w-full" placeholder="Prénom" bind:value={newName} />
				<label class="form-label">
					Foyer
					<Select class="mt-1 w-full" bind:value={newHousehold}>
						<option value="__new__">Nouveau foyer (cette personne seule)</option>
						{#each tripState.households as h (h.id)}
							<option value={h.id}>Rejoindre : {h.name}</option>
						{/each}
					</Select>
				</label>
				{#if addError}
					<FieldError>{addError}</FieldError>
				{/if}
				<Button type="submit" class="w-full" disabled={adding}>
					{adding ? 'Ajout…' : 'Ajouter'}
				</Button>
			</form>
		</Card>
	{/if}

	{#if addNotice}
		<Alert tone="warning" class="p-2 text-xs">{addNotice}</Alert>
	{/if}

	<PanelList>
		{#each tripState.participants as p (p.participant_id)}
			<ListRow>
				{#if editingId === p.participant_id}
					<div class="space-y-2">
						<label class="block text-xs text-slate-500">
							Prénom
							<TextInput class="mt-1 w-full text-sm" bind:value={editName} />
						</label>
						<label class="block text-xs text-slate-500">
							Foyer <span class="text-slate-400">(partagé : renomme pour tous ses membres)</span>
							<TextInput class="mt-1 w-full text-sm" bind:value={editHousehold} />
						</label>
						{#if editError}
							<FieldError>{editError}</FieldError>
						{/if}
						<div class="flex gap-2">
							<Button size="sm" disabled={saving} onclick={() => onSaveEdit(p)}>
								{saving ? '…' : 'Enregistrer'}
							</Button>
							<Button size="sm" variant="secondary" onclick={() => (editingId = null)}
								>Annuler</Button
							>
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-between gap-2">
						<span class:text-slate-400={!p.active}>
							{p.person_name}
							{#if !p.active}<MetaText>(parti)</MetaText>{/if}
							<MetaText>· {p.household_name}</MetaText>
						</span>
						<div class="flex shrink-0 items-center gap-2">
							<span
								class="flex items-center gap-1.5 text-xs {p.active
									? 'text-emerald-700'
									: 'text-slate-400'}"
							>
								{p.active ? 'présent' : 'parti'}
								<Switch
									checked={p.active}
									label={p.active ? 'Présent (basculer sur parti)' : 'Parti (basculer sur présent)'}
									onclick={() => onToggleActive(p)}
								/>
							</span>
							<IconButton
								icon={Pencil}
								label="Modifier"
								variant="warning"
								onclick={() => startEdit(p)}
							/>
							<IconButton
								icon={copied === p.invite_token ? Check : Link}
								label="Copier le lien d'invitation"
								variant="outline"
								class={copied === p.invite_token ? 'text-emerald-600' : ''}
								onclick={() => copyLink(p.invite_token)}
							/>
						</div>
					</div>
				{/if}
			</ListRow>
		{/each}
	</PanelList>
</section>
