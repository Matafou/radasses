<script lang="ts">
	import { page } from '$app/stores';
	import { TripState, setTripState } from '$lib/trip.svelte';

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
	<div class="mx-auto grid max-w-md grid-cols-4">
		<a href={`/t/${tripId}`} class={tabClass(isActive(''))}>Dépenses</a>
		<a href={`/t/${tripId}/soldes`} class={tabClass(isActive('soldes'))}>Soldes</a>
		<a href={`/t/${tripId}/participants`} class={tabClass(isActive('participants'))}>Participants</a>
		<a href={`/t/${tripId}/journal`} class={tabClass(isActive('journal'))}>Journal</a>
	</div>
</nav>
