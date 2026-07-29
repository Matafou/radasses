<script lang="ts">
	import { untrack } from 'svelte';
	import { getTripState, type ExpensePrefill } from '$lib/trip.svelte';
	import type { Expense, Participant } from '$lib/db';
	import type { BeneficiaryInput } from '$lib/expenses';
	import { previewSplit } from '$lib/split';
	import { centsFromEuros, money } from '$lib/format';

	let { expense = null, prefill = null, onDone, onCancel }: {
		expense?: Expense | null;
		prefill?: ExpensePrefill | null;
		onDone: () => void;
		onCancel?: () => void;
	} = $props();

	const tripState = getTripState();
	const editing = $derived(expense != null);

	// --- Bénéficiaires regroupés par foyer (pour cocher tout un foyer d'un coup) ---
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
	// Auto-sélection : on ne considère QUE les participants actifs (« présents »).
	const foyerAll = (g: Group) => {
		const a = g.members.filter((p) => p.active);
		return a.length > 0 && a.every((p) => selected[p.person_id]);
	};
	const foyerSome = (g: Group) => {
		const a = g.members.filter((p) => p.active);
		const n = a.filter((p) => selected[p.person_id]).length;
		return n > 0 && n < a.length;
	};
	function toggleFoyer(g: Group) {
		const all = foyerAll(g);
		for (const p of g.members) if (p.active) selected[p.person_id] = !all;
	}

	// --- Instantané initial (composant remonté via {#key}) ---
	function initSelected(): Record<string, boolean> {
		const sel: Record<string, boolean> = {};
		let allow: Set<string> | null = null;
		if (expense) allow = new Set((tripState.benefByExpense.get(expense.id) ?? []).map((b) => b.person_id));
		else if (prefill) allow = new Set(prefill.beneficiary_person_ids);
		// nouvelle dépense : cocher par défaut les participants actifs seulement
		for (const p of tripState.participants) sel[p.person_id] = allow ? allow.has(p.person_id) : p.active;
		return sel;
	}
	function initDetail() {
		const benef = expense ? (tripState.benefByExpense.get(expense.id) ?? []) : [];
		const byPerson = new Map(benef.map((b) => [b.person_id, b]));
		const mode: Record<string, 'weight' | 'amount'> = {};
		const value: Record<string, string> = {};
		for (const p of tripState.participants) {
			const b = byPerson.get(p.person_id);
			if (b?.is_locked) {
				mode[p.person_id] = 'amount';
				value[p.person_id] = String(b.amount_cents / 100);
			} else {
				mode[p.person_id] = 'weight';
				value[p.person_id] = b?.weight != null ? String(b.weight) : '1';
			}
		}
		const detailed = benef.some((b) => b.is_locked || (b.weight != null && Number(b.weight) !== 1));
		return { mode, value, detailed };
	}

	const init = untrack(() => {
		const d = initDetail();
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		return {
			amountStr: expense
				? String(expense.amount_cents / 100)
				: prefill
					? String(prefill.amount_cents / 100)
					: '',
			description: expense?.description ?? prefill?.description ?? '',
			payerId:
				expense?.paid_by_person_id ??
				prefill?.paid_by_person_id ??
				tripState.myPersonId ??
				tripState.participants[0]?.person_id ??
				'',
			spentOn: expense?.spent_on ?? today,
			selected: initSelected(),
			detailed: d.detailed,
			benefMode: d.mode,
			benefValue: d.value
		};
	});

	let amountStr = $state(init.amountStr);
	let description = $state(init.description);
	let payerId = $state(init.payerId);
	let spentOn = $state(init.spentOn);
	let selected = $state<Record<string, boolean>>(init.selected);
	let detailed = $state(init.detailed);
	let benefMode = $state<Record<string, 'weight' | 'amount'>>(init.benefMode);
	let benefValue = $state<Record<string, string>>(init.benefValue);
	let saving = $state(false);
	let formError = $state<string | null>(null);

	// En création, signale au layout qu'une saisie est en cours (montant ou libellé saisi)
	// → le FAB propose « Reprendre » plutôt que d'ouvrir un formulaire vierge.
	const dirty = $derived(amountStr.trim() !== '' || description.trim() !== '');
	$effect(() => {
		tripState.hasCreateDraft = !editing && dirty;
	});

	const beneficiaries = $derived.by((): BeneficiaryInput[] => {
		const out: BeneficiaryInput[] = [];
		for (const p of tripState.participants) {
			if (!selected[p.person_id]) continue;
			if (!detailed) {
				out.push({ person_id: p.person_id }); // parts égales
			} else if ((benefMode[p.person_id] ?? 'weight') === 'amount') {
				const c = centsFromEuros(benefValue[p.person_id] ?? '');
				out.push({ person_id: p.person_id, is_locked: true, amount_cents: Number.isFinite(c) && c >= 0 ? c : 0 });
			} else {
				const wv = Number(String(benefValue[p.person_id] ?? '1').replace(',', '.'));
				out.push({ person_id: p.person_id, is_locked: false, weight: Number.isFinite(wv) && wv > 0 ? wv : 1 });
			}
		}
		return out;
	});

	// Prévisualisation live des montants (miroir du backend).
	const totalCents = $derived(centsFromEuros(amountStr));
	const preview = $derived(
		Number.isFinite(totalCents) && totalCents > 0 ? previewSplit(totalCents, beneficiaries) : {}
	);
	const amountOf = (pid: string) =>
		preview.amounts && preview.amounts[pid] != null
			? money(preview.amounts[pid], tripState.currency)
			: '—';

	// Le seul bénéficiaire non-figé (mode poids) est « forcé » : son montant = le reste,
	// quel que soit son poids -> on grise sa saisie et on l'indique.
	const forcedId = $derived.by(() => {
		if (!detailed) return null;
		const u = beneficiaries.filter((b) => !b.is_locked);
		return u.length === 1 ? u[0].person_id : null;
	});

	// Sélection globale
	const activeParticipants = $derived(tripState.participants.filter((p) => p.active));
	const allSelected = $derived(
		activeParticipants.length > 0 && activeParticipants.every((p) => selected[p.person_id])
	);
	const someSelected = $derived(activeParticipants.some((p) => selected[p.person_id]));
	function toggleAll() {
		const all = allSelected;
		for (const p of activeParticipants) selected[p.person_id] = !all;
	}

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		const cents = centsFromEuros(amountStr);
		const chosen = beneficiaries;
		if (!payerId) return void (formError = 'Choisis qui a payé.');
		if (!Number.isFinite(cents) || cents <= 0) return void (formError = 'Montant invalide.');
		if (!chosen.length) return void (formError = 'Sélectionne au moins un bénéficiaire.');
		const pv = previewSplit(cents, chosen);
		if (pv.error) return void (formError = pv.error);
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

{#snippet memberRow(p: Participant)}
	<div class="flex items-center gap-2 text-sm">
		<label class="flex items-center gap-1">
			<input type="checkbox" bind:checked={selected[p.person_id]} />
			{p.person_name}{#if !p.active}<span class="ml-1 text-xs text-slate-400">(parti)</span>{/if}
		</label>
		{#if detailed && selected[p.person_id]}
			<select
				class="rounded border border-slate-300 px-1 py-0.5 text-xs {p.person_id === forcedId
					? 'bg-slate-100 text-slate-400'
					: ''}"
				disabled={p.person_id === forcedId}
				bind:value={benefMode[p.person_id]}
			>
				<option value="weight">poids</option>
				<option value="amount">€ fixe</option>
			</select>
			<input
				class="w-16 rounded border border-slate-300 px-2 py-0.5 text-sm {p.person_id === forcedId
					? 'bg-slate-100 text-slate-400'
					: ''}"
				inputmode="decimal"
				disabled={p.person_id === forcedId}
				placeholder={benefMode[p.person_id] === 'amount' ? '€' : '1'}
				bind:value={benefValue[p.person_id]}
			/>
		{/if}
		{#if selected[p.person_id]}
			<span class="ml-auto flex items-center gap-1 whitespace-nowrap text-xs">
				{#if p.person_id === forcedId}<span class="font-medium text-red-600">forcé</span>{/if}
				<span class="tabular-nums text-slate-500">{amountOf(p.person_id)}</span>
			</span>
		{/if}
	</div>
{/snippet}

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
		<legend class="px-1 text-xs text-slate-400">Bénéficiaires</legend>
		<label class="flex items-center gap-2 text-sm font-medium">
			<input
				type="checkbox"
				checked={allSelected}
				indeterminate={someSelected && !allSelected}
				onchange={toggleAll}
			/>
			Tout le monde
		</label>
		<label class="flex items-center gap-2 text-xs text-slate-500">
			<button
				type="button"
				role="switch"
				aria-checked={detailed}
				aria-label="Répartition détaillée"
				onclick={() => (detailed = !detailed)}
				class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {detailed
					? 'bg-slate-900'
					: 'bg-slate-300'}"
			>
				<span
					class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {detailed
						? 'translate-x-4'
						: 'translate-x-0.5'}"
				></span>
			</button>
			Répartition détaillée (poids ou montants fixes)
		</label>
		{#each groups as g (g.id)}
			{#if g.members.length === 1}
				{@render memberRow(g.members[0])}
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
					<div class="ml-6 space-y-1">
						{#each g.members as p (p.person_id)}
							{@render memberRow(p)}
						{/each}
					</div>
				</div>
			{/if}
		{/each}
		{#if detailed}
			<p class="px-1 text-xs text-slate-400">
				Poids = parts relatives (1 par défaut). « € fixe » verrouille un montant ; il doit
				rester au moins un bénéficiaire en poids pour absorber le reste.
			</p>
		{/if}
		{#if preview.error}
			<p class="px-1 text-xs text-amber-600">{preview.error}</p>
		{/if}
	</fieldset>

	{#if formError}
		<p class="text-sm text-red-600">{formError}</p>
	{/if}
	<div class="flex gap-2">
		<button
			class="flex-1 rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50 {editing
				? 'bg-amber-600'
				: 'bg-green-600'}"
			disabled={saving}
		>
			{saving ? (editing ? 'Modification…' : 'Création…') : editing ? 'Modifier' : 'Créer'}
		</button>
		<button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-slate-600" onclick={() => (onCancel ?? onDone)()}>
			Annuler
		</button>
	</div>
</form>
