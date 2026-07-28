<script lang="ts">
	import { untrack } from 'svelte';
	import { getTripState, type ExpensePrefill } from '$lib/trip.svelte';
	import type { Expense, Participant } from '$lib/db';
	import { centsFromEuros } from '$lib/format';

	let { expense = null, prefill = null, onDone }: {
		expense?: Expense | null;
		prefill?: ExpensePrefill | null;
		onDone: () => void;
	} = $props();

	const tripState = getTripState();
	const editing = $derived(expense != null);

	// Sélection initiale : bénéficiaires actuels si édition, sinon tout le monde.
	// (Composant remonté via {#key} par la page -> init au montage suffit.)
	function initSelected(): Record<string, boolean> {
		const sel: Record<string, boolean> = {};
		let allow: Set<string> | null = null;
		if (expense) allow = new Set((tripState.benefByExpense.get(expense.id) ?? []).map((b) => b.person_id));
		else if (prefill) allow = new Set(prefill.beneficiary_person_ids);
		for (const p of tripState.participants) sel[p.person_id] = allow ? allow.has(p.person_id) : true;
		return sel;
	}

	// Snapshot unique au montage (le composant est remonté via {#key} quand la
	// dépense éditée change) -> figer les valeurs initiales est voulu.
	const init = untrack(() => ({
		amountStr: expense
			? String(expense.amount_cents / 100)
			: prefill
				? String(prefill.amount_cents / 100)
				: '',
		description: expense?.description ?? prefill?.description ?? '',
		payerId:
			expense?.paid_by_person_id ?? prefill?.paid_by_person_id ?? tripState.participants[0]?.person_id ?? '',
		spentOn: expense?.spent_on ?? '',
		selected: initSelected()
	}));
	let amountStr = $state(init.amountStr);
	let description = $state(init.description);
	let payerId = $state(init.payerId);
	let spentOn = $state(init.spentOn);
	let selected = $state<Record<string, boolean>>(init.selected);
	let saving = $state(false);
	let formError = $state<string | null>(null);

	// Bénéficiaires regroupés par foyer, pour cocher tout un foyer d'un coup.
	type Group = { id: string; name: string; members: Participant[] };
	const groups = $derived.by((): Group[] => {
		const m = new Map<string, Group>();
		for (const p of tripState.participants) {
			let g = m.get(p.household_id);
			if (!g) {
				g = { id: p.household_id, name: p.household_name, members: [] };
				m.set(p.household_id, g);
			}
			g.members.push(p);
		}
		return Array.from(m.values());
	});
	const foyerAll = (g: Group) => g.members.every((p) => selected[p.person_id]);
	const foyerSome = (g: Group) => {
		const n = g.members.filter((p) => selected[p.person_id]).length;
		return n > 0 && n < g.members.length;
	};
	function toggleFoyer(g: Group) {
		const all = foyerAll(g);
		for (const p of g.members) selected[p.person_id] = !all;
	}

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		const cents = centsFromEuros(amountStr);
		const chosen = tripState.participants
			.filter((p) => selected[p.person_id])
			.map((p) => ({ person_id: p.person_id }));
		if (!payerId) return void (formError = 'Choisis qui a payé.');
		if (!Number.isFinite(cents) || cents <= 0) return void (formError = 'Montant invalide.');
		if (!chosen.length) return void (formError = 'Sélectionne au moins un bénéficiaire.');
		saving = true;
		try {
			await tripState.upsertExpense({
				amount_cents: cents,
				paid_by_person_id: payerId,
				beneficiaries: chosen,
				description: description.trim(),
				spent_on: spentOn || null,
				expense_id: expense?.id ?? null,
				expected_version: expense?.version ?? null
			});
			onDone();
		} catch (err) {
			formError = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-2 rounded-lg border border-slate-200 bg-white p-3" onsubmit={onSubmit}>
	{#if editing}
		<p class="text-sm font-medium text-slate-600">Modifier la dépense</p>
	{/if}
	<div class="flex gap-2">
		<input class="w-28 rounded-lg border border-slate-300 px-3 py-2" placeholder="Montant €" inputmode="decimal" bind:value={amountStr} />
		<input class="flex-1 rounded-lg border border-slate-300 px-3 py-2" placeholder="Description" bind:value={description} />
	</div>
	<div class="flex gap-2">
		<label class="flex-1 text-sm text-slate-600">
			Payé par
			<select class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" bind:value={payerId}>
				{#each tripState.participants as p (p.person_id)}
					<option value={p.person_id}>{p.person_name}</option>
				{/each}
			</select>
		</label>
		<label class="text-sm text-slate-600">
			Date
			<input type="date" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" bind:value={spentOn} />
		</label>
	</div>
	<fieldset class="space-y-2 rounded-lg border border-slate-200 p-2">
		<legend class="px-1 text-xs text-slate-400">Bénéficiaires (parts égales)</legend>
		{#each groups as g (g.id)}
			{#if g.members.length === 1}
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={selected[g.members[0].person_id]} />
					{g.members[0].person_name}
				</label>
			{:else}
				<div>
					<label class="flex items-center gap-2 text-sm font-medium">
						<input
							type="checkbox"
							checked={foyerAll(g)}
							indeterminate={foyerSome(g)}
							onchange={() => toggleFoyer(g)}
						/>
						{g.name} <span class="text-xs font-normal text-slate-400">— tout le foyer</span>
					</label>
					<div class="ml-6 flex flex-wrap gap-x-4 gap-y-1">
						{#each g.members as p (p.person_id)}
							<label class="flex items-center gap-1 text-sm">
								<input type="checkbox" bind:checked={selected[p.person_id]} />
								{p.person_name}
							</label>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</fieldset>
	{#if formError}
		<p class="text-sm text-red-600">{formError}</p>
	{/if}
	<div class="flex gap-2">
		<button class="flex-1 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={saving}>
			{saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter la dépense'}
		</button>
		{#if editing}
			<button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-slate-600" onclick={onDone}>
				Annuler
			</button>
		{/if}
	</div>
</form>
