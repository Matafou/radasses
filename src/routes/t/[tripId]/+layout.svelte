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

<div class="flex min-h-0 flex-1 flex-col">
	<header class="flex-none border-b border-slate-200 bg-white">
		<div class="flex items-center gap-3 px-4 py-3">
			<a href="/" aria-label="Retour aux séjours" title="Séjours" class="shrink-0 text-slate-400 hover:text-slate-600">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
				</svg>
			</a>
			<h1 class="min-w-0 flex-1 truncate text-lg font-semibold">{state.trip?.name ?? 'Séjour'}</h1>
			<a
				href={`/t/${tripId}/reglages`}
				aria-label="Réglages"
				title="Réglages"
				class="shrink-0 hover:text-slate-600 {isActive('reglages') ? 'text-slate-900' : 'text-slate-400'}"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="h-5 w-5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.49l1.216.455c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
				</svg>
			</a>
		</div>
	</header>

	{#if state.error}
		<p class="mx-4 mt-3 flex-none rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
	{/if}

	<div class="min-h-0 flex-1 overflow-y-auto p-4">
		{#if state.loading && !state.trip}
			<p class="text-slate-400">Chargement…</p>
		{:else}
			{@render children()}
		{/if}
	</div>

	<nav class="flex-none border-t border-slate-200 bg-white">
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
						class="absolute bottom-full left-[12.5%] z-20 -mb-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-700"
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
					class="absolute bottom-full left-[12.5%] z-20 -mb-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-green-600 text-xl leading-none text-white shadow-lg hover:bg-green-700"
				>
					+
				</button>
			{/if}
		{/if}
	</div>
	</nav>
</div>

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
