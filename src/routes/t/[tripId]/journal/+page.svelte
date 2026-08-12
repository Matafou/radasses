<script lang="ts">
	import { errMessage } from '$lib/util';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ChevronDown, ChevronRight, Lock } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import { backend, type Operation } from '$lib/backend';
	import { money } from '$lib/format';
	import { isUndoable } from '$lib/undo';
	import { offlineWrite } from '$lib/offline-guard';
	import {
		Alert,
		Button,
		ListRow,
		LoadingText,
		MetaText,
		PanelList,
		SectionHeader
	} from '$lib/components/ui';

	const tripState = getTripState();

	let ops = $state<Operation[]>([]);
	let actors = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let expandedId = $state<number | null>(null);

	$effect(() => {
		const id = tripState.tripId;
		if (id) load(id);
	});
	async function load(id: string) {
		loading = true;
		error = null;
		try {
			[ops, actors] = await Promise.all([backend.listOperations(id), backend.listActors(id)]);
		} catch (e) {
			error = errMessage(e);
		} finally {
			loading = false;
		}
	}

	const actionLabel: Record<string, string> = {
		create: 'ajout',
		update: 'modification',
		delete: 'suppression'
	};
	const cur = () => tripState.currency;
	const pname = (id: string) => tripState.personName.get(id) ?? '?';
	const hname = (id: string) => tripState.householdName.get(id) ?? '?';
	function when(iso: string): string {
		return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	}
	function toggle(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	// « Défaire » : dispo sur la DERNIÈRE opération de dépense de son entité (cf. undo.ts).
	let undoing = $state(false);
	const canUndo = (op: Operation) => isUndoable(op, ops);
	async function doUndo(op: Operation) {
		if (!confirm('Défaire cette opération ?')) return;
		undoing = true;
		error = null;
		try {
			await tripState.undoOperation(op);
			await load(tripState.tripId); // recharge le journal (op de compensation)
		} catch (e) {
			error = errMessage(e);
		} finally {
			undoing = false;
		}
	}

	type JsonRecord = Record<string, unknown>;

	function asRecord(value: unknown): JsonRecord | null {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as JsonRecord)
			: null;
	}

	function asString(value: unknown, fallback = ''): string {
		return typeof value === 'string' ? value : fallback;
	}

	function asNumber(value: unknown): number | null {
		return typeof value === 'number' ? value : null;
	}

	function summary(op: Operation): string {
		const d = asRecord(op.after ?? op.before);
		if (op.entity_type === 'expense') {
			const e = asRecord(d?.expense) ?? d;
			const amount = asNumber(e?.amount_cents);
			const amt = amount != null ? ' ' + money(amount, cur()) : '';
			return `Dépense « ${asString(e?.description, 'sans nom') || 'sans nom'} »${amt}`;
		}
		if (op.entity_type === 'settlement') {
			const amount = asNumber(d?.amount_cents);
			return `Remboursement${amount != null ? ' ' + money(amount, cur()) : ''}`;
		}
		if (op.entity_type === 'participant') {
			const personId = asString(d?.person_id);
			const name = personId ? pname(personId) : 'participant';
			return `Participant ${name}`;
		}
		return op.entity_type;
	}

	// Détail générique d'une ligne (règlement / participant), bruit filtré + ids -> noms.
	const HIDE = new Set([
		'id',
		'trip_id',
		'created_at',
		'updated_at',
		'version',
		'invite_token',
		'expense_id',
		'deleted_at',
		'created_by',
		'actor_auth_user_id'
	]);
	function rowEntries(row: unknown): [string, string][] {
		const record = asRecord(row);
		if (!record) return [];
		const out: [string, string][] = [];
		for (const [k, v] of Object.entries(record)) {
			if (HIDE.has(k)) continue;
			if (k === 'amount_cents') out.push(['montant', money(Number(v), cur())]);
			else if (k === 'person_id') out.push(['personne', pname(v as string)]);
			else if (k === 'paid_by_person_id') out.push(['payé par', pname(v as string)]);
			else if (k === 'household_id') out.push(['foyer', hname(v as string)]);
			else if (k === 'from_household_id') out.push(['de', hname(v as string)]);
			else if (k === 'to_household_id') out.push(['vers', hname(v as string)]);
			else if (k === 'active') out.push(['présent', v ? 'oui' : 'non']);
			else if (k === 'default_weight') out.push(['poids défaut', String(v)]);
			else out.push([k, String(v)]);
		}
		return out;
	}
</script>

{#snippet snap(title: string, s: unknown)}
	{@const record = asRecord(s)}
	{#if record}
		{@const expense = asRecord(record.expense)}
		{@const beneficiaries = Array.isArray(record.beneficiaries) ? record.beneficiaries : []}
		<div>
			<p class="font-medium text-slate-500">{title}</p>
			{#if expense}
				<p>
					{asString(expense.description, 'sans nom') || 'sans nom'} ·
					{money(Number(expense.amount_cents ?? 0), cur())} · {asString(expense.spent_on)} · payé par
					{pname(asString(expense.paid_by_person_id))}
				</p>
				<ul class="ml-4 list-disc">
					{#each beneficiaries as b, i (asString(asRecord(b)?.person_id, String(i)))}
						{@const benef = asRecord(b)}
						{#if benef}
							<li class="inline-flex items-center gap-0.5">
								{pname(asString(benef.person_id))} : {money(Number(benef.amount_cents ?? 0), cur())}
								{#if benef.is_locked}<Lock size={12} aria-label="montant verrouillé" />{/if}
							</li>
						{/if}
					{/each}
				</ul>
			{:else}
				<ul class="ml-4 list-disc">
					{#each rowEntries(s) as [k, v] (k)}
						<li>{k} : {v}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
{/snippet}

<section class="space-y-2">
	<SectionHeader title="Journal" />
	{#if error}
		<Alert>{error}</Alert>
	{/if}
	{#if loading}
		<LoadingText />
	{:else}
		<PanelList>
			{#each ops as op (op.id)}
				<li class="text-sm">
					<button
						class="flex w-full items-baseline justify-between gap-2 px-4 py-2 text-left hover:bg-slate-50"
						onclick={() => toggle(op.id)}
					>
						<span>
							<MetaText>{actionLabel[op.action] ?? op.action}</MetaText>
							· {summary(op)}
							{#if op.actor_auth_user_id && actors[op.actor_auth_user_id]}
								<MetaText>— par {actors[op.actor_auth_user_id]}</MetaText>
							{/if}
						</span>
						<MetaText class="shrink-0">
							{when(op.created_at)}
							{#if expandedId === op.id}
								<ChevronDown size={14} class="inline" aria-hidden="true" />
							{:else}
								<ChevronRight size={14} class="inline" aria-hidden="true" />
							{/if}
						</MetaText>
					</button>
					{#if expandedId === op.id}
						<div
							class="space-y-2 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600"
						>
							{@render snap('Avant', op.before)}
							{@render snap('Après', op.after)}
							{#if !op.before && !op.after}
								<p class="text-slate-400">Pas de détail.</p>
							{/if}
							{#if canUndo(op)}
								<Button
									size="sm"
									variant="secondary"
									disabled={undoing}
									{...offlineWrite(() => doUndo(op), 'Défaire indisponible hors-ligne.')}
								>
									Défaire
								</Button>
							{/if}
						</div>
					{/if}
				</li>
			{:else}
				<ListRow class="text-sm text-slate-400">Aucune opération.</ListRow>
			{/each}
		</PanelList>
	{/if}
</section>
