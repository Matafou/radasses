<script lang="ts">
	import { page } from '$app/stores';
	import { beforeNavigate } from '$app/navigation';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowLeft, Pencil, Plus, Settings } from '@lucide/svelte';
	import { TripState, setTripState } from '$lib/trip.svelte';
	import ExpenseForm from '$lib/components/ExpenseForm.svelte';
	import ReimbursementForm from '$lib/components/ReimbursementForm.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Fab from '$lib/components/ui/Fab.svelte';

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
			<a
				href="/"
				aria-label="Retour aux séjours"
				title="Séjours"
				class="shrink-0 text-slate-400 hover:text-slate-600"
			>
				<ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
			</a>
			<h1 class="min-w-0 flex-1 truncate text-lg font-semibold">{state.trip?.name ?? 'Séjour'}</h1>
			<a
				href={`/t/${tripId}/reglages`}
				aria-label="Réglages"
				title="Réglages"
				class="shrink-0 hover:text-slate-600 {isActive('reglages')
					? 'text-slate-900'
					: 'text-slate-400'}"
			>
				<Settings size={20} strokeWidth={1.8} aria-hidden="true" />
			</a>
		</div>
	</header>

	{#if state.error}
		<Alert class="mx-4 mt-3 flex-none">{state.error}</Alert>
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
			<a href={`/t/${tripId}/participants`} class={tabClass(isActive('participants'))}
				>Participants</a
			>
			<a href={`/t/${tripId}/journal`} class={tabClass(isActive('journal'))}>Journal</a>

			<!-- Bouton d'ajout ancré juste au-dessus de l'onglet « Dépenses » (1re colonne sur 4) -->
			{#if state.trip && !state.formOpen}
				{#if state.hasCreateDraft}
					<Fab
						icon={Pencil}
						label="Reprendre la saisie en cours"
						variant="warning"
						class="absolute bottom-full left-[12.5%] z-20 -mb-2 -translate-x-1/2"
						onclick={() => state.openNewExpense()}
					/>
				{:else}
					<Fab
						icon={Plus}
						label="Ajouter une dépense"
						class="absolute bottom-full left-[12.5%] z-20 -mb-2 -translate-x-1/2"
						onclick={() => state.openNewExpense()}
					/>
				{/if}
			{/if}
		</div>
	</nav>
</div>

{#if state.trip}
	<BottomSheet
		open={state.formOpen}
		closeLabel={state.reimburse ? 'Fermer' : 'Masquer (garder la saisie)'}
		onClose={() => (state.reimburse ? state.closeExpenseForm() : state.hideExpenseForm())}
	>
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
	</BottomSheet>
{/if}
