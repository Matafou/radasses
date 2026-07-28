<script lang="ts">
	import { getTripState } from '$lib/trip.svelte';
	import { listOperations, listActors, type Operation } from '$lib/db';
	import { money } from '$lib/format';

	const tripState = getTripState();

	let ops = $state<Operation[]>([]);
	let actors = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);

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
	function when(iso: string): string {
		return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	}
	function summary(op: Operation): string {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const d: any = op.after ?? op.before;
		if (op.entity_type === 'expense') {
			const e = d?.expense ?? d;
			const amt = e?.amount_cents != null ? ' ' + money(e.amount_cents, tripState.currency) : '';
			return `Dépense « ${e?.description || 'sans nom'} »${amt}`;
		}
		if (op.entity_type === 'settlement') {
			return `Remboursement${d?.amount_cents != null ? ' ' + money(d.amount_cents, tripState.currency) : ''}`;
		}
		if (op.entity_type === 'participant') {
			const name = d?.person_id ? (tripState.personName.get(d.person_id) ?? 'participant') : 'participant';
			return `Participant ${name}`;
		}
		return op.entity_type;
	}
</script>

<section class="space-y-2">
	<h2 class="text-sm font-medium text-slate-500">Journal</h2>
	{#if error}
		<p class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
	{/if}
	{#if loading}
		<p class="text-slate-400">Chargement…</p>
	{:else}
		<ul class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
			{#each ops as op (op.id)}
				<li class="px-4 py-2 text-sm">
					<div class="flex items-baseline justify-between gap-2">
						<span>
							<span class="text-slate-400">{actionLabel[op.action] ?? op.action}</span>
							· {summary(op)}
						</span>
						<span class="shrink-0 text-xs text-slate-400">{when(op.created_at)}</span>
					</div>
					{#if op.actor_auth_user_id && actors[op.actor_auth_user_id]}
						<p class="text-xs text-slate-400">par {actors[op.actor_auth_user_id]}</p>
					{/if}
				</li>
			{:else}
				<li class="px-4 py-3 text-sm text-slate-400">Aucune opération.</li>
			{/each}
		</ul>
	{/if}
</section>
