<script lang="ts">
	import { untrack } from 'svelte';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowRight, Check } from '@lucide/svelte';
	import { getTripState, type ReimbursePrefill } from '$lib/trip.svelte';
	import { centsFromEuros } from '$lib/format';
	import { todayISO } from '$lib/date';
	import { Button, Card, FieldError, Select, TextInput } from '$lib/components/ui';

	let {
		prefill = {},
		onDone,
		onCancel
	}: {
		prefill?: ReimbursePrefill;
		onDone: () => void;
		onCancel?: () => void;
	} = $props();

	const tripState = getTripState();

	// Un remboursement = une dépense à UN bénéficiaire non-figé : le débiteur paie,
	// le créancier est l'unique bénéficiaire (il « reçoit » donc tout le montant).
	const init = untrack(() => {
		return {
			fromId:
				prefill.from_person_id ??
				tripState.myPersonId ??
				tripState.participants[0]?.person_id ??
				'',
			toId: prefill.to_person_id ?? '',
			amountStr: prefill.amount_cents != null ? String(prefill.amount_cents / 100) : '',
			spentOn: todayISO()
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
		if (fromId === toId)
			return void (formError = 'Le payeur et le bénéficiaire doivent être différents.');
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

<Card>
	<form class="space-y-3" onsubmit={onSubmit}>
		<p class="text-sm font-medium text-slate-600">Remboursement</p>

		<div class="flex items-end gap-2">
			<label class="inline-form-label flex-1">
				Qui rembourse
				<Select class="mt-1 w-full px-2" bind:value={fromId}>
					{#each tripState.participants as p (p.person_id)}
						<option value={p.person_id}>{p.person_name}{p.active ? '' : ' (parti)'}</option>
					{/each}
				</Select>
			</label>
			<ArrowRight size={18} class="mb-2 shrink-0 text-slate-400" aria-hidden="true" />
			<label class="inline-form-label flex-1">
				Qui est remboursé
				<Select class="mt-1 w-full px-2" bind:value={toId}>
					<option value="">—</option>
					{#each tripState.participants as p (p.person_id)}
						<option value={p.person_id}>{p.person_name}{p.active ? '' : ' (parti)'}</option>
					{/each}
				</Select>
			</label>
		</div>

		<div class="flex gap-2">
			<TextInput class="w-32" placeholder="Montant €" inputmode="decimal" bind:value={amountStr} />
			<TextInput type="date" bind:value={spentOn} />
		</div>

		{#if formError}
			<FieldError>{formError}</FieldError>
		{/if}

		<div class="flex gap-2">
			<Button type="submit" variant="success" class="flex-1" disabled={saving}>
				{#if !saving}<Check size={16} aria-hidden="true" />{/if}
				{saving ? 'Enregistrement…' : 'Confirmer le remboursement'}
			</Button>
			<Button variant="secondary" onclick={() => (onCancel ?? onDone)()}>Annuler</Button>
		</div>
	</form>
</Card>
