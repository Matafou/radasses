<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import {
		getTrip, listParticipants, listExpenses, listBeneficiaries, getBalances,
		type Trip, type Participant, type Expense, type Beneficiary, type Balance
	} from '$lib/db';
	import { saveExpense, deleteExpense } from '$lib/expenses';
	import { addParticipant } from '$lib/auth';
	import { euros, centsFromEuros } from '$lib/format';

	let tripId = $derived($page.params.tripId!); // garanti par la route [tripId]

	let loading = $state(true);
	let error = $state<string | null>(null);
	let trip = $state<Trip | null>(null);
	let participants = $state<Participant[]>([]);
	let expenses = $state<Expense[]>([]);
	let beneficiaries = $state<Beneficiary[]>([]);
	let balances = $state<Balance[]>([]);

	let personName = $derived(new Map(participants.map((p) => [p.person_id, p.person_name])));
	let householdName = $derived(new Map(participants.map((p) => [p.household_id, p.household_name])));
	let households = $derived(
		Array.from(householdName.entries()).map(([id, name]) => ({ id, name }))
	);
	let benefByExpense = $derived.by(() => {
		const m = new Map<string, Beneficiary[]>();
		for (const b of beneficiaries) {
			const arr = m.get(b.expense_id);
			if (arr) arr.push(b);
			else m.set(b.expense_id, [b]);
		}
		return m;
	});

	// formulaire dépense
	let payerId = $state('');
	let amountStr = $state('');
	let description = $state('');
	let spentOn = $state('');
	let selected = $state<Record<string, boolean>>({});
	let savingExpense = $state(false);

	// formulaire participant
	let showAddP = $state(false);
	let newName = $state('');
	let newHousehold = $state('__new__');
	let addingP = $state(false);

	$effect(() => {
		load(tripId);
	});

	async function load(id: string) {
		loading = true;
		error = null;
		try {
			[trip, participants, expenses, beneficiaries, balances] = await Promise.all([
				getTrip(id), listParticipants(id), listExpenses(id), listBeneficiaries(id), getBalances(id)
			]);
			const sel = { ...selected };
			for (const p of participants) if (!(p.person_id in sel)) sel[p.person_id] = true;
			selected = sel;
			if (!payerId && participants.length) payerId = participants[0].person_id;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function inviteLink(token: string): string {
		const origin = typeof location !== 'undefined' ? location.origin : '';
		return `${origin}${base}/?token=${token}`;
	}
	async function copyLink(token: string) {
		try {
			await navigator.clipboard.writeText(inviteLink(token));
		} catch {
			/* clipboard indispo : ignoré */
		}
	}

	async function onAddExpense(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		const cents = centsFromEuros(amountStr);
		const chosen = participants.filter((p) => selected[p.person_id]).map((p) => ({ person_id: p.person_id }));
		if (!payerId) return (error = 'Choisis qui a payé.'), undefined;
		if (!Number.isFinite(cents) || cents <= 0) return (error = 'Montant invalide.'), undefined;
		if (!chosen.length) return (error = 'Sélectionne au moins un bénéficiaire.'), undefined;
		savingExpense = true;
		try {
			await saveExpense({
				trip_id: tripId, amount_cents: cents, paid_by_person_id: payerId,
				beneficiaries: chosen, description: description.trim(), spent_on: spentOn || null
			});
			amountStr = '';
			description = '';
			await load(tripId);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			savingExpense = false;
		}
	}

	async function onDelete(exp: Expense) {
		if (!confirm('Supprimer cette dépense ?')) return;
		error = null;
		try {
			await deleteExpense({ trip_id: tripId, expense_id: exp.id, expected_version: exp.version });
			await load(tripId);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function onAddParticipant(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		if (!newName.trim()) return (error = 'Nom requis.'), undefined;
		addingP = true;
		try {
			await addParticipant({
				trip_id: tripId, person_name: newName.trim(),
				household_id: newHousehold === '__new__' ? null : newHousehold
			});
			newName = '';
			newHousehold = '__new__';
			showAddP = false;
			await load(tripId);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			addingP = false;
		}
	}
</script>

{#if loading && !trip}
	<p class="text-slate-400">Chargement…</p>
{:else}
	<div class="space-y-6">
		<div>
			<a href="/" class="text-sm text-slate-400">← séjours</a>
			<h1 class="text-xl font-semibold">{trip?.name ?? 'Séjour'}</h1>
		</div>

		{#if error}
			<p class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
		{/if}

		<!-- Soldes -->
		<section class="space-y-2">
			<h2 class="text-sm font-medium text-slate-500">Soldes par foyer</h2>
			<ul class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
				{#each balances as b (b.household_id)}
					<li class="flex items-center justify-between px-4 py-3">
						<span>{householdName.get(b.household_id) ?? '?'}</span>
						<span
							class={b.net_cents > 0 ? 'font-medium text-emerald-600'
								: b.net_cents < 0 ? 'font-medium text-red-600' : 'text-slate-400'}
						>
							{b.net_cents > 0 ? '+' : ''}{euros(b.net_cents)}
							<span class="ml-1 text-xs text-slate-400">
								{b.net_cents > 0 ? 'on lui doit' : b.net_cents < 0 ? 'doit' : ''}
							</span>
						</span>
					</li>
				{:else}
					<li class="px-4 py-3 text-sm text-slate-400">Aucun solde.</li>
				{/each}
			</ul>
		</section>

		<!-- Participants -->
		<section class="space-y-2">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-medium text-slate-500">Participants</h2>
				<button class="text-sm text-slate-700 underline" onclick={() => (showAddP = !showAddP)}>
					{showAddP ? 'annuler' : '+ ajouter'}
				</button>
			</div>

			{#if showAddP}
				<form class="space-y-2 rounded-lg border border-slate-200 bg-white p-3" onsubmit={onAddParticipant}>
					<input class="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Prénom" bind:value={newName} />
					<label class="block text-sm text-slate-600">
						Foyer
						<select class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" bind:value={newHousehold}>
							<option value="__new__">Nouveau foyer (cette personne seule)</option>
							{#each households as h (h.id)}
								<option value={h.id}>Rejoindre : {h.name}</option>
							{/each}
						</select>
					</label>
					<button class="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={addingP}>
						{addingP ? 'Ajout…' : 'Ajouter'}
					</button>
				</form>
			{/if}

			<ul class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
				{#each participants as p (p.participant_id)}
					<li class="flex items-center justify-between px-4 py-3">
						<span>{p.person_name} <span class="text-xs text-slate-400">· {p.household_name}</span></span>
						<button class="text-xs text-slate-500 underline" onclick={() => copyLink(p.invite_token)}>copier le lien</button>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Dépenses -->
		<section class="space-y-2">
			<h2 class="text-sm font-medium text-slate-500">Dépenses</h2>

			<form class="space-y-2 rounded-lg border border-slate-200 bg-white p-3" onsubmit={onAddExpense}>
				<div class="flex gap-2">
					<input class="w-28 rounded-lg border border-slate-300 px-3 py-2" placeholder="Montant €" inputmode="decimal" bind:value={amountStr} />
					<input class="flex-1 rounded-lg border border-slate-300 px-3 py-2" placeholder="Description" bind:value={description} />
				</div>
				<div class="flex gap-2">
					<label class="flex-1 text-sm text-slate-600">
						Payé par
						<select class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" bind:value={payerId}>
							{#each participants as p (p.person_id)}
								<option value={p.person_id}>{p.person_name}</option>
							{/each}
						</select>
					</label>
					<label class="text-sm text-slate-600">
						Date
						<input type="date" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" bind:value={spentOn} />
					</label>
				</div>
				<fieldset class="rounded-lg border border-slate-200 p-2">
					<legend class="px-1 text-xs text-slate-400">Bénéficiaires (parts égales)</legend>
					<div class="flex flex-wrap gap-x-4 gap-y-1">
						{#each participants as p (p.person_id)}
							<label class="flex items-center gap-1 text-sm">
								<input type="checkbox" bind:checked={selected[p.person_id]} />
								{p.person_name}
							</label>
						{/each}
					</div>
				</fieldset>
				<button class="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={savingExpense}>
					{savingExpense ? 'Ajout…' : 'Ajouter la dépense'}
				</button>
			</form>

			<ul class="space-y-2">
				{#each expenses as e (e.id)}
					<li class="rounded-lg border border-slate-200 bg-white p-3">
						<div class="flex items-start justify-between">
							<div>
								<p class="font-medium">{e.description || 'Dépense'}</p>
								<p class="text-xs text-slate-400">
									{e.spent_on} · payé par {personName.get(e.paid_by_person_id) ?? '?'}
								</p>
							</div>
							<div class="text-right">
								<p class="font-semibold">{euros(e.amount_cents)}</p>
								<button class="text-xs text-red-500 underline" onclick={() => onDelete(e)}>supprimer</button>
							</div>
						</div>
						<ul class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
							{#each benefByExpense.get(e.id) ?? [] as b (b.person_id)}
								<li>
									{personName.get(b.person_id) ?? '?'} : {euros(b.amount_cents)}{b.is_locked ? ' 🔒' : ''}
								</li>
							{/each}
						</ul>
					</li>
				{:else}
					<li class="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
						Aucune dépense pour l'instant.
					</li>
				{/each}
			</ul>
		</section>
	</div>
{/if}
