<script lang="ts">
	import { untrack } from 'svelte';
	import { getTripState, type ReimbursePrefill } from '$lib/trip.svelte';
	import { centsFromEuros } from '$lib/format';

	let { prefill = {}, onDone, onCancel }: {
		prefill?: ReimbursePrefill;
		onDone: () => void;
		onCancel?: () => void;
	} = $props();

	const tripState = getTripState();

	// Un remboursement = une dépense à UN bénéficiaire non-figé : le débiteur paie,
	// le créancier est l'unique bénéficiaire (il « reçoit » donc tout le montant).
	const init = untrack(() => {
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		return {
			fromId: prefill.from_person_id ?? tripState.myPersonId ?? tripState.participants[0]?.person_id ?? '',
			toId: prefill.to_person_id ?? '',
			amountStr: prefill.amount_cents != null ? String(prefill.amount_cents / 100) : '',
			spentOn: today
		};
	});

	let fromId = $state(init.fromId);
	let toId = $state(init.toId);
	let amountStr = $state(init.amountStr);
	let spentOn = $state(init.spentOn);
	let saving = $state(false);
	let formError = $state<string | null>(null);

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		const cents = centsFromEuros(amountStr);
		if (!fromId) return void (formError = 'Choisis qui rembourse.');
		if (!toId) return void (formError = 'Choisis qui est remboursé.');
		if (fromId === toId) return void (formError = 'Le payeur et le bénéficiaire doivent être différents.');
		if (!Number.isFinite(cents) || cents <= 0) return void (formError = 'Montant invalide.');
		saving = true;
		try {
			await tripState.upsertExpense({
				amount_cents: cents,
				paid_by_person_id: fromId,
				beneficiaries: [{ person_id: toId }], // unique non-figé → reçoit tout
				description: 'Remboursement',
				spent_on: spentOn || null,
				expense_id: null,
				expected_version: null
			});
			onDone();
		} catch (err) {
			formError = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-3 rounded-lg border border-slate-200 bg-white p-3" onsubmit={onSubmit}>
	<p class="text-sm font-medium text-slate-600">Remboursement</p>

	<div class="flex items-end gap-2">
		<label class="flex-1 text-sm text-slate-600">
			Qui rembourse
			<select class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" bind:value={fromId}>
				{#each tripState.participants as p (p.person_id)}
					<option value={p.person_id}>{p.person_name}{p.active ? '' : ' (parti)'}</option>
				{/each}
			</select>
		</label>
		<span class="pb-2 text-slate-400">→</span>
		<label class="flex-1 text-sm text-slate-600">
			Qui est remboursé
			<select class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" bind:value={toId}>
				<option value="">—</option>
				{#each tripState.participants as p (p.person_id)}
					<option value={p.person_id}>{p.person_name}{p.active ? '' : ' (parti)'}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="flex gap-2">
		<input class="w-32 rounded-lg border border-slate-300 px-3 py-2" placeholder="Montant €" inputmode="decimal" bind:value={amountStr} />
		<input type="date" class="rounded-lg border border-slate-300 px-3 py-2" bind:value={spentOn} />
	</div>

	{#if formError}
		<p class="text-sm text-red-600">{formError}</p>
	{/if}

	<div class="flex gap-2">
		<button class="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={saving}>
			{saving ? 'Enregistrement…' : '✓ Confirmer le remboursement'}
		</button>
		<button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-slate-600" onclick={() => (onCancel ?? onDone)()}>
			Annuler
		</button>
	</div>
</form>
