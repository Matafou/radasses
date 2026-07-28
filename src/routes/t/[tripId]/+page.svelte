<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { getTripState } from '$lib/trip.svelte';
	import type { Expense } from '$lib/db';
	import { euros } from '$lib/format';
	import ExpenseForm from '$lib/components/ExpenseForm.svelte';

	const tripState = getTripState();
	let editing = $state<Expense | null>(null);

	function onDone() {
		editing = null;
		tripState.prefill = null; // consomme un éventuel pré-remplissage (remboursement)
	}

	// Un remboursement pré-rempli mais non validé ne doit pas être perdu en silence.
	beforeNavigate((nav) => {
		if (tripState.prefill) {
			if (confirm('Un remboursement est pré-rempli mais pas encore enregistré. Quitter sans l’enregistrer ?')) {
				tripState.prefill = null;
			} else {
				nav.cancel();
			}
		}
	});
	$effect(() => {
		function onUnload(e: BeforeUnloadEvent) {
			if (tripState.prefill) {
				e.preventDefault();
				e.returnValue = '';
			}
		}
		window.addEventListener('beforeunload', onUnload);
		return () => window.removeEventListener('beforeunload', onUnload);
	});

	async function onDelete(exp: Expense) {
		if (!confirm('Supprimer cette dépense ?')) return;
		try {
			await tripState.removeExpense(exp);
			if (editing?.id === exp.id) editing = null;
		} catch (err) {
			tripState.error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<section class="space-y-2">
	{#key editing?.id ?? (tripState.prefill ? 'prefill' : 'new')}
		<ExpenseForm expense={editing} prefill={editing ? null : tripState.prefill} onDone={onDone} />
	{/key}

	<ul class="space-y-2">
		{#each tripState.expenses as e (e.id)}
			<li class="rounded-lg border bg-white p-3 {editing?.id === e.id ? 'border-slate-900' : 'border-slate-200'}">
				<div class="flex items-start justify-between">
					<div>
						<p class="font-medium">{e.description || 'Dépense'}</p>
						<p class="text-xs text-slate-400">
							{e.spent_on} · payé par {tripState.personName.get(e.paid_by_person_id) ?? '?'}
						</p>
					</div>
					<div class="text-right">
						<p class="font-semibold">{euros(e.amount_cents)}</p>
						<div class="flex justify-end gap-2">
							<button class="text-xs text-slate-500 underline" onclick={() => (editing = e)}>modifier</button>
							<button class="text-xs text-red-500 underline" onclick={() => onDelete(e)}>supprimer</button>
						</div>
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
