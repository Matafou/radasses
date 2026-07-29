<script lang="ts">
	import { page } from '$app/stores';
	import { beforeNavigate } from '$app/navigation';
	import { TripState, setTripState } from '$lib/trip.svelte';
	import ExpenseForm from '$lib/components/ExpenseForm.svelte';
	import ReimbursementForm from '$lib/components/ReimbursementForm.svelte';

	let { children } = $props();
	let tripId = $derived($page.params.tripId!);

	const state = new TripState();
	setTripState(state);
	$effect(() => {
		state.setTrip(tripId);
	});

	let path = $derived($page.url.pathname);
	function isActive(suffix: string): boolean {
		if (suffix === '') return path === `/t/${tripId}` || path === `/t/${tripId}/`;
		return path.endsWith(`/${suffix}`);
	}
	function tabClass(active: boolean): string {
		return `py-3 text-center text-xs ${active ? 'font-semibold text-slate-900' : 'text-slate-400'}`;
	}

	// La navigation entre onglets conserve la saisie (le sheet vit dans ce layout).
	// Seul un départ du séjour démonte le composant et perd la saisie → on prévient.
	beforeNavigate((nav) => {
		if (!(state.formOpen || state.hasCreateDraft)) return;
		const to = nav.to?.url.pathname ?? '';
		if (to.startsWith(`/t/${tripId}`)) return; // navigation interne : rien à perdre
		if (confirm('Une dépense est en cours de saisie. Quitter le séjour sans l’enregistrer ?')) {
			state.closeExpenseForm();
		} else {
			nav.cancel();
		}
	});
	$effect(() => {
		function onUnload(e: BeforeUnloadEvent) {
			if (state.formOpen || state.hasCreateDraft) {
				e.preventDefault();
				e.returnValue = '';
			}
		}
		window.addEventListener('beforeunload', onUnload);
		return () => window.removeEventListener('beforeunload', onUnload);
	});
</script>

<div class="pb-16">
	<div class="mb-4 flex items-start justify-between gap-2">
		<div>
			<a href="/" class="text-sm text-slate-400">← séjours</a>
			<h1 class="text-xl font-semibold">{state.trip?.name ?? 'Séjour'}</h1>
		</div>
		<a
			href={`/t/${tripId}/reglages`}
			class="mt-1 shrink-0 text-sm hover:text-slate-600 {isActive('reglages')
				? 'text-slate-900'
				: 'text-slate-400'}"
		>
			⚙ réglages
		</a>
	</div>

	{#if state.error}
		<p class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
	{/if}

	{#if state.loading && !state.trip}
		<p class="text-slate-400">Chargement…</p>
	{:else}
		{@render children()}
	{/if}
</div>

<nav class="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white">
	<div class="relative mx-auto grid max-w-md grid-cols-4">
		<a href={`/t/${tripId}`} class={tabClass(isActive(''))}>Dépenses</a>
		<a href={`/t/${tripId}/soldes`} class={tabClass(isActive('soldes'))}>Soldes</a>
		<a href={`/t/${tripId}/participants`} class={tabClass(isActive('participants'))}>Participants</a>
		<a href={`/t/${tripId}/journal`} class={tabClass(isActive('journal'))}>Journal</a>

		<!-- Bouton d'ajout ancré juste au-dessus de l'onglet « Dépenses » (1re colonne sur 4) -->
		{#if state.trip && !state.formOpen}
			{#if state.hasCreateDraft}
				<button
					type="button"
					aria-label="Reprendre la saisie en cours"
					title="Reprendre la saisie en cours"
					onclick={() => state.openNewExpense()}
					class="absolute bottom-full left-[12.5%] -mb-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-700"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
						<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
					</svg>
				</button>
			{:else}
				<button
					type="button"
					aria-label="Ajouter une dépense"
					onclick={() => state.openNewExpense()}
					class="absolute bottom-full left-[12.5%] -mb-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-green-600 text-xl leading-none text-white shadow-lg hover:bg-green-700"
				>
					+
				</button>
			{/if}
		{/if}
	</div>
</nav>

{#if state.trip}
	<!-- Backdrop : masquer (dépense, saisie gardée) ou fermer (remboursement) -->
	{#if state.formOpen}
		<button
			type="button"
			aria-label={state.reimburse ? 'Fermer' : 'Masquer'}
			onclick={() => (state.reimburse ? state.closeExpenseForm() : state.hideExpenseForm())}
			class="fixed inset-0 z-30 bg-black/30"
		></button>
	{/if}

	<!-- Bottom-sheet : toujours monté (translaté hors écran quand fermé) → la saisie persiste -->
	<div
		class="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl rounded-t-2xl bg-white shadow-xl transition-transform duration-200 {state.formOpen
			? 'translate-y-0'
			: 'pointer-events-none translate-y-full'}"
	>
		<div class="max-h-[85vh] overflow-y-auto p-3">
			<div class="relative mb-2 flex h-6 items-center justify-center">
				<div class="h-1 w-10 rounded-full bg-slate-300"></div>
				<button
					type="button"
					aria-label={state.reimburse ? 'Fermer' : 'Masquer'}
					title={state.reimburse ? 'Fermer' : 'Masquer (garder la saisie)'}
					onclick={() => (state.reimburse ? state.closeExpenseForm() : state.hideExpenseForm())}
					class="absolute right-0 text-slate-400 hover:text-slate-600"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
						<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
					</svg>
				</button>
			</div>
			{#if state.reimburse}
				<ReimbursementForm
					prefill={state.reimburse}
					onDone={() => state.closeExpenseForm()}
					onCancel={() => state.closeExpenseForm()}
				/>
			{:else}
				{#key state.editingExpense?.id ?? `new-${state.formSeq}`}
					<ExpenseForm
						expense={state.editingExpense}
						onDone={() => state.closeExpenseForm()}
						onCancel={() => state.closeExpenseForm()}
					/>
				{/key}
			{/if}
		</div>
	</div>
{/if}
