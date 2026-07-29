<script lang="ts">
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ChevronDown, ChevronRight, Lock } from '@lucide/svelte';
	import { getTripState } from '$lib/trip.svelte';
	import { listOperations, listActors, type Operation } from '$lib/db';
	import { money } from '$lib/format';
	import {
		Alert,
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
			[ops, actors] = await Promise.all([listOperations(id), listActors(id)]);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
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

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function summary(op: Operation): string {
		const d: any = op.after ?? op.before;
		if (op.entity_type === 'expense') {
			const e = d?.expense ?? d;
			const amt = e?.amount_cents != null ? ' ' + money(e.amount_cents, cur()) : '';
			return `Dépense « ${e?.description || 'sans nom'} »${amt}`;
		}
		if (op.entity_type === 'settlement') {
			return `Remboursement${d?.amount_cents != null ? ' ' + money(d.amount_cents, cur()) : ''}`;
		}
		if (op.entity_type === 'participant') {
			const name = d?.person_id ? pname(d.person_id) : 'participant';
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function rowEntries(row: any): [string, string][] {
		if (!row) return [];
		const out: [string, string][] = [];
		for (const [k, v] of Object.entries(row)) {
			if (HIDE.has(k)) continue;
			if (k === 'amount_cents') out.push(['montant', money(v as number, cur())]);
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

{#snippet snap(title: string, s: any)}
	{#if s}
		<div>
			<p class="font-medium text-slate-500">{title}</p>
			{#if s.expense}
				<p>
					{s.expense.description || 'sans nom'} · {money(s.expense.amount_cents, cur())} ·
					{s.expense.spent_on} · payé par {pname(s.expense.paid_by_person_id)}
				</p>
				<ul class="ml-4 list-disc">
					{#each s.beneficiaries ?? [] as b (b.person_id)}
						<li class="inline-flex items-center gap-0.5">
							{pname(b.person_id)} : {money(b.amount_cents, cur())}
							{#if b.is_locked}<Lock size={12} aria-label="montant verrouillé" />{/if}
						</li>
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
						</div>
					{/if}
				</li>
			{:else}
				<ListRow class="text-sm text-slate-400">Aucune opération.</ListRow>
			{/each}
		</PanelList>
	{/if}
</section>
