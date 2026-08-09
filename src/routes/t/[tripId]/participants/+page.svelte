<script lang="ts">
	import { base, resolve } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { Pencil, Plus, Share2, X } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import { offlineWrite } from '$lib/offline-guard';
	import { foyerLabel } from '$lib/format';
	import { autofocusWithin } from '$lib/actions/autofocus';
	import type { Participant } from '$lib/backend';
	import HouseholdSelect from '$lib/components/HouseholdSelect.svelte';
	import ShareSheet from '$lib/components/ShareSheet.svelte';
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
		Switch,
		TextInput
	} from '$lib/components/ui';

	const tripState = getTripState();

	// Participants regroupés par foyer (ordre de 1re apparition), pour un en-tête
	// de foyer renommable au-dessus de ses membres.
	type Group = { id: string; name: string; members: Participant[] };
	const groups = $derived.by((): Group[] => {
		const byId: Record<string, Group> = {};
		const out: Group[] = [];
		for (const p of tripState.participants) {
			let g = byId[p.household_id];
			if (!g) {
				g = { id: p.household_id, name: p.household_name, members: [] };
				byId[p.household_id] = g;
				out.push(g);
			}
			g.members.push(p);
		}
		return out;
	});

	// renommage d'un foyer (en-tête de groupe)
	let editingHouseholdId = $state<string | null>(null);
	let householdNameDraft = $state('');
	let householdSaving = $state(false);
	let householdError = $state<string | null>(null);

	// ajout
	let showAdd = $state(false);
	let newName = $state('');
	let newHousehold = $state('__new__');
	let adding = $state(false);
	let addError = $state<string | null>(null);
	let addNotice = $state<string | null>(null);
	let sharing = $state<Participant | null>(null); // participant dont on partage le lien (ouvre la feuille)
	let sharingTrip = $state(false); // partage du lien de séjour (un pour tous, « Qui es-tu ? »)

	// édition
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editHouseholdId = $state(''); // household_id courant, ou '__new__'
	let editWeight = $state('1'); // poids par défaut (chaîne, décimale FR/EN tolérée)
	let saving = $state(false);
	let editError = $state<string | null>(null);

	// Liens d'accès (le lien EST la crédential). Le partage lui-même (canaux, copie) est
	// mutualisé dans <ShareSheet> ; ici on ne construit que l'URL et le message.
	function inviteLink(token: string): string {
		const origin = typeof location !== 'undefined' ? location.origin : '';
		return `${origin}${base}/?token=${token}`;
	}
	function tripInviteLink(): string {
		const origin = typeof location !== 'undefined' ? location.origin : '';
		return `${origin}${base}/?join=${tripState.trip?.join_token ?? ''}`;
	}
	const tripName = () => tripState.trip?.name ?? 'le séjour';
	const shareSubject = () => `Rejoindre « ${tripName()} » sur radasses`;
	const participantShareText = (p: Participant) =>
		`Salut ${p.person_name}, voici ton lien pour rejoindre le séjour « ${tripName()} » sur radasses :`;
	const tripShareText = () =>
		`Rejoins le séjour « ${tripName()} » sur radasses — choisis ton nom dans la liste :`;

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

	function startRenameHousehold(g: Group) {
		editingHouseholdId = g.id;
		householdNameDraft = g.name;
		householdError = null;
	}
	async function onSaveHouseholdName(g: Group) {
		householdError = null;
		const name = householdNameDraft.trim();
		if (!name) return void (householdError = 'Nom de foyer requis.');
		householdSaving = true;
		try {
			await tripState.renameHousehold(g.id, name);
			editingHouseholdId = null;
		} catch (err) {
			householdError = err instanceof Error ? err.message : String(err);
		} finally {
			householdSaving = false;
		}
	}

	function startEdit(p: Participant) {
		editingId = p.participant_id;
		editName = p.person_name;
		editHouseholdId = p.household_id;
		editWeight = String(p.default_weight);
		editError = null;
	}
	async function onSaveEdit(p: Participant) {
		editError = null;
		const name = editName.trim();
		if (!name) return void (editError = 'Nom requis.');
		const weight = Number(editWeight.replace(',', '.'));
		if (!Number.isFinite(weight) || weight <= 0)
			return void (editError = 'Poids par défaut invalide (nombre > 0).');
		const moved = editHouseholdId !== p.household_id;
		saving = true;
		try {
			await tripState.updateParticipant({
				person_id: p.person_id,
				participant_id: p.participant_id,
				person_name: name !== p.person_name ? name : undefined,
				default_weight: weight !== p.default_weight ? weight : undefined,
				move_household_id: !moved ? undefined : editHouseholdId === '__new__' ? null : editHouseholdId,
				new_household_name: editHouseholdId === '__new__' ? name : undefined
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
		{...offlineWrite(
			() => (showAdd = !showAdd),
			'Ajout de participant indisponible hors-ligne.'
		)}
	/>
{/snippet}

{#snippet memberRow(p: Participant)}
	{#if editingId === p.participant_id}
		<div class="space-y-2" use:autofocusWithin>
			<label class="block text-xs text-slate-500">
				Prénom
				<TextInput class="mt-1 w-full text-sm" bind:value={editName} data-autofocus />
			</label>
			<label class="block text-xs text-slate-500">
				Foyer <span class="text-slate-400">(déplace ce participant ; l'historique suit)</span>
				<HouseholdSelect class="mt-1 w-full text-sm" bind:value={editHouseholdId} />
			</label>
			<label class="block text-xs text-slate-500">
				Poids par défaut
				<span class="text-slate-400">(1 = part normale ; ex. 0,5 pour un enfant)</span>
				<TextInput
					class="mt-1 w-24 text-sm"
					inputmode="decimal"
					placeholder="1"
					bind:value={editWeight}
				/>
			</label>
			{#if editError}
				<FieldError>{editError}</FieldError>
			{/if}
			<div class="flex gap-2">
				<Button size="sm" disabled={saving} onclick={() => onSaveEdit(p)}>
					{saving ? '…' : 'Enregistrer'}
				</Button>
				<Button size="sm" variant="secondary" onclick={() => (editingId = null)}>Annuler</Button>
			</div>
		</div>
	{:else}
		<div class="flex items-center justify-between gap-2">
			<span class:text-slate-400={!p.active}>
				<a
					class="link-inline"
					href={resolve('/t/[tripId]/personne/[personId]', {
						tripId: tripState.tripId,
						personId: p.person_id
					})}>{p.person_name}</a
				>
				{#if !p.active}<MetaText>(parti)</MetaText>{/if}
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
						{...offlineWrite(() => onToggleActive(p), 'Modification indisponible hors-ligne.')}
					/>
				</span>
				<IconButton
					icon={Pencil}
					label="Modifier"
					variant="warning"
					{...offlineWrite(() => startEdit(p), 'Modification indisponible hors-ligne.')}
				/>
				<IconButton
					icon={Share2}
					label="Partager le lien d'invitation"
					variant="outline"
					onclick={() => (sharing = p)}
				/>
			</div>
		</div>
	{/if}
{/snippet}

<section class="space-y-2">
	<SectionHeader
		title="Participants"
		description="Un membre « parti » reste dans le séjour, mais n'est plus coché par défaut dans les nouvelles dépenses."
		actions={addParticipantAction}
	/>

	<Button variant="outline" class="w-full" onclick={() => (sharingTrip = true)}>
		<Share2 size={16} aria-hidden="true" />
		Partager le lien du séjour
	</Button>

	{#if showAdd}
		<Card>
			<form class="space-y-2" onsubmit={onAdd} use:autofocusWithin>
				<TextInput class="w-full" placeholder="Prénom" bind:value={newName} data-autofocus />
				<label class="form-label">
					Foyer
					<HouseholdSelect
						class="mt-1 w-full"
						bind:value={newHousehold}
						optionPrefix="Rejoindre "
					/>
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

	<div class="space-y-4">
		{#each groups as g (g.id)}
			<div>
				<!-- En-tête de foyer : un TITRE (pas une ligne de liste), pour ne pas
				     dupliquer le nom dans `li.list-row` (un foyer d'une personne porte
				     le nom de la personne). -->
				<div class="mb-1 flex min-h-7 items-center justify-between gap-2 px-1">
					{#if editingHouseholdId === g.id}
						<div class="flex flex-1 items-center gap-2" use:autofocusWithin>
							<TextInput
								class="min-w-0 flex-1 text-sm"
								bind:value={householdNameDraft}
								data-autofocus
							/>
							<Button
								size="sm"
								disabled={householdSaving}
								onclick={() => onSaveHouseholdName(g)}
							>
								{householdSaving ? '…' : 'Enregistrer'}
							</Button>
							<Button size="sm" variant="secondary" onclick={() => (editingHouseholdId = null)}>
								Annuler
							</Button>
						</div>
					{:else}
						<h2 class="text-sm font-medium text-slate-600 first-letter:uppercase">
							<a
								class="link-inline"
								href={resolve('/t/[tripId]/foyer/[householdId]', {
									tripId: tripState.tripId,
									householdId: g.id
								})}>{foyerLabel(g.name)}</a
							>
						</h2>
						<IconButton
							icon={Pencil}
							label="Renommer le foyer"
							variant="warning"
							{...offlineWrite(() => startRenameHousehold(g), 'Modification indisponible hors-ligne.')}
						/>
					{/if}
				</div>
				{#if householdError && editingHouseholdId === g.id}
					<div class="mb-1 px-1"><FieldError>{householdError}</FieldError></div>
				{/if}
				<PanelList>
					{#each g.members as p (p.participant_id)}
						<ListRow>
							{@render memberRow(p)}
						</ListRow>
					{/each}
				</PanelList>
			</div>
		{/each}
	</div>
</section>

<!-- Partage du lien d'invitation d'un participant (le lien = crédential nominatif). -->
<ShareSheet
	open={sharing !== null}
	onClose={() => (sharing = null)}
	title={sharing ? `Partager le lien de ${sharing.person_name}` : ''}
	subject={shareSubject()}
	text={sharing ? participantShareText(sharing) : ''}
	url={sharing ? inviteLink(sharing.invite_token) : ''}
	warning={sharing
		? `Ce lien donne l'accès au séjour au nom de ${sharing.person_name} : partage-le par un canal individuel (message privé), évite les groupes.`
		: undefined}
/>

<!-- Partage du lien de SÉJOUR (un pour tous ; chacun choisit son nom, « Qui es-tu ? »). -->
<ShareSheet
	open={sharingTrip}
	onClose={() => (sharingTrip = false)}
	title="Partager le lien du séjour"
	subject={shareSubject()}
	text={tripShareText()}
	url={tripInviteLink()}
	warning="Chacun choisira son nom dans la liste du séjour : partage ce lien avec les participants, évite de le rendre public."
/>
