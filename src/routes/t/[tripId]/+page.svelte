<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { getTripState } from '$lib/trip.svelte';
	import type { Expense } from '$lib/db';
	import { money } from '$lib/format';
	import ExpenseForm from '$lib/components/ExpenseForm.svelte';

	const tripState = getTripState();
	const fmt = (c: number) => money(c, tripState.currency);
	// `editingExpense` vit dans TripState -> l'édition survit au changement d'onglet
	// (et le défaut « payé par = moi » ne s'applique donc qu'à une nouvelle dépense).

	// Le formulaire de création est replié par défaut ; une édition ou un
	// remboursement pré-rempli le déploie automatiquement.
	let showForm = $state(false);
	const formOpen = $derived(showForm || !!tripState.editingExpense || !!tripState.prefill);

	function onDone() {
		tripState.editingExpense = null;
		tripState.prefill = null; // consomme un éventuel pré-remplissage (remboursement)
		showForm = false; // repli après création / édition
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
			if (tripState.editingExpense?.id === exp.id) tripState.editingExpense = null;
		} catch (err) {
			tripState.error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<section class="space-y-2">
	{#if formOpen}
		{#key tripState.editingExpense?.id ?? (tripState.prefill ? 'prefill' : 'new')}
			<ExpenseForm
				expense={tripState.editingExpense}
				prefill={tripState.editingExpense ? null : tripState.prefill}
				onDone={onDone}
			/>
		{/key}
	{:else}
		<button
			type="button"
			class="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700"
			onclick={() => (showForm = true)}
		>
			＋ Ajouter une dépense
		</button>
	{/if}

	<ul class="space-y-2">
		{#each tripState.expenses as e (e.id)}
			<li class="rounded-lg border bg-white p-3 {tripState.editingExpense?.id === e.id ? 'border-slate-900' : 'border-slate-200'}">
				<div class="flex items-start justify-between">
					<div>
						<p class="font-medium">{e.description || 'Dépense'}</p>
						<p class="text-xs text-slate-400">
							{e.spent_on} · payé par {tripState.personName.get(e.paid_by_person_id) ?? '?'}
						</p>
					</div>
					<div class="text-right">
						<p class="font-semibold">{fmt(e.amount_cents)}</p>
						<div class="flex items-center justify-end gap-2">
							<button
								type="button"
								aria-label="Modifier"
								title="Modifier"
								class="inline-flex items-center rounded-md bg-amber-600 p-1 text-white hover:bg-amber-700"
								onclick={() => (tripState.editingExpense = e)}
							>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
									<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
								</svg>
							</button>
							<button
								type="button"
								aria-label="Supprimer"
								title="Supprimer"
								class="inline-flex items-center rounded-md bg-red-600 p-1 text-white hover:bg-red-700"
								onclick={() => onDelete(e)}
							>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
									<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.16-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.04-2.09 1.02-2.09 2.2v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
								</svg>
							</button>
						</div>
					</div>
				</div>
				<ul class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
					{#each tripState.benefByExpense.get(e.id) ?? [] as b (b.person_id)}
						<li>{tripState.personName.get(b.person_id) ?? '?'} : {fmt(b.amount_cents)}{b.is_locked ? ' 🔒' : ''}</li>
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
