<script lang="ts">
	import { page } from '$app/stores';
	import { beforeNavigate } from '$app/navigation';
	import { TripState, setTripState } from '$lib/trip.svelte';
	import ExpenseForm from '$lib/components/ExpenseForm.svelte';
	import ReimbursementForm from '$lib/components/ReimbursementForm.svelte';
	import { Alert, BottomSheet, LoadingText, TripBottomNav, TripHeader } from '$lib/components/ui';

	let { children } = $props();
	let tripId = $derived($page.params.tripId!);

	const state = new TripState();
	setTripState(state);
	$effect(() => {
		state.setTrip(tripId);
	});

	let path = $derived($page.url.pathname);
	// « Revenir en arrière » n'apparaît que sur les sous-pages (foyer / personne /
	// réglages / journal), pas sur les onglets de premier niveau. réglages et journal
	// n'ont pas de segment après → on les teste en fin de chemin.
	let showBack = $derived(
		/\/(foyer|personne)\//.test(path) || /\/(reglages|journal)$/.test(path)
	);
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
	<TripHeader
		{tripId}
		title={state.trip?.name ?? 'Séjour'}
		settingsActive={path.endsWith('/reglages')}
		{showBack}
	/>

	{#if state.error}
		<Alert class="mx-4 mt-3 flex-none">{state.error}</Alert>
	{/if}

	<div class="min-h-0 flex-1 overflow-y-auto p-4">
		{#if state.loading && !state.trip}
			<LoadingText />
		{:else}
			{@render children()}
		{/if}
	</div>

	<TripBottomNav
		{tripId}
		{path}
		showFab={Boolean(state.trip) && !state.formOpen}
		hasDraft={state.hasCreateDraft}
		onAdd={() => state.openNewExpense()}
	/>
</div>

{#if state.trip}
	<BottomSheet
		open={state.formOpen}
		title={state.reimburse
			? 'Signaler un remboursement'
			: state.editingExpense
				? 'Modifier la dépense'
				: 'Nouvelle dépense'}
		closeLabel={state.reimburse ? 'Fermer' : 'Masquer (garder la saisie)'}
		onClose={() => (state.reimburse ? state.closeExpenseForm() : state.hideExpenseForm())}
	>
		{#if state.reimburse}
			<ReimbursementForm
				prefill={state.reimburse}
				onDone={() => state.closeExpenseForm()}
				onCancel={() => state.closeExpenseForm()}
			/>
		{:else if state.formOpen || state.hasCreateDraft}
			<!-- Montage paresseux : le formulaire n'existe que sheet ouvert (ou brouillon
			     à reprendre). Le snapshot des participants se fait donc à la 1re ouverture,
			     participants à jour → cas courant correct par construction (le catch-up
			     $effect ne sert plus qu'au flux rare « Masquer → ajouter un participant →
			     Reprendre »). -->
			{#key state.editingExpense?.id ?? `new-${state.formSeq}`}
				<ExpenseForm
					expense={state.editingExpense}
					onDone={() => state.closeExpenseForm()}
					onCancel={() => state.closeExpenseForm()}
				/>
			{/key}
		{/if}
	</BottomSheet>
{/if}
