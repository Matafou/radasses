<script lang="ts">
	import { untrack } from 'svelte';
	import { getTripState } from '$lib/trip.svelte';
	import type { Expense } from '$lib/db';
	import { euros, centsFromEuros } from '$lib/format';

	const tripState = getTripState();
	// (renommé depuis `state` : le rune $state réserve le préfixe $state)

	let payerId = $state('');
	let amountStr = $state('');
	let description = $state('');
	let spentOn = $state('');
	let selected = $state<Record<string, boolean>>({});
	let saving = $state(false);
	let formError = $state<string | null>(null);

	// coche par défaut les nouveaux participants, sans boucler
	$effect(() => {
		const ps = tripState.participants;
		untrack(() => {
			let changed = false;
			const next = { ...selected };
			for (const p of ps) if (!(p.person_id in next)) {
				next[p.person_id] = true;
				changed = true;
			}
			if (changed) selected = next;
			if (!payerId && ps.length) payerId = ps[0].person_id;
		});
	});

	async function onAdd(e: SubmitEvent) {
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
			await tripState.addExpense({
				amount_cents: cents, paid_by_person_id: payerId, beneficiaries: chosen,
				description: description.trim(), spent_on: spentOn || null
			});
			amountStr = '';
			description = '';
		} catch (err) {
			formError = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	async function onDelete(exp: Expense) {
		if (!confirm('Supprimer cette dépense ?')) return;
		try {
			await tripState.removeExpense(exp);
		} catch (err) {
			tripState.error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<section class="space-y-2">
	<form class="space-y-2 rounded-lg border border-slate-200 bg-white p-3" onsubmit={onAdd}>
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
		<fieldset class="rounded-lg border border-slate-200 p-2">
			<legend class="px-1 text-xs text-slate-400">Bénéficiaires (parts égales)</legend>
			<div class="flex flex-wrap gap-x-4 gap-y-1">
				{#each tripState.participants as p (p.person_id)}
					<label class="flex items-center gap-1 text-sm">
						<input type="checkbox" bind:checked={selected[p.person_id]} />
						{p.person_name}
					</label>
				{/each}
			</div>
		</fieldset>
		{#if formError}
			<p class="text-sm text-red-600">{formError}</p>
		{/if}
		<button class="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={saving}>
			{saving ? 'Ajout…' : 'Ajouter la dépense'}
		</button>
	</form>

	<ul class="space-y-2">
		{#each tripState.expenses as e (e.id)}
			<li class="rounded-lg border border-slate-200 bg-white p-3">
				<div class="flex items-start justify-between">
					<div>
						<p class="font-medium">{e.description || 'Dépense'}</p>
						<p class="text-xs text-slate-400">
							{e.spent_on} · payé par {tripState.personName.get(e.paid_by_person_id) ?? '?'}
						</p>
					</div>
					<div class="text-right">
						<p class="font-semibold">{euros(e.amount_cents)}</p>
						<button class="text-xs text-red-500 underline" onclick={() => onDelete(e)}>supprimer</button>
					</div>
				</div>
				<ul class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
					{#each tripState.benefByExpense.get(e.id) ?? [] as b (b.person_id)}
						<li>{tripState.personName.get(b.person_id) ?? '?'} : {euros(b.amount_cents)}{b.is_locked ? ' 🔒' : ''}</li>
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
