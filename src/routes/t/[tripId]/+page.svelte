<script lang="ts">
	import { getTripState } from '$lib/trip.svelte';
	import ExpenseCard from '$lib/components/ExpenseCard.svelte';
	import { EmptyState } from '$lib/components/ui';

	const tripState = getTripState();
	// Le formulaire de dépense (création/édition) vit dans le layout (bottom-sheet) ;
	// chaque carte ouvre l'édition de sa ligne (via `ExpenseCard`).
</script>

<section class="space-y-2">
	<ul class="space-y-2">
		{#each tripState.expenses as e (e.id)}
			<li>
				<ExpenseCard expense={e} />
			</li>
		{:else}
			<li>
				<EmptyState>Aucune dépense pour l'instant. Touchez « + » pour en ajouter une.</EmptyState>
			</li>
		{/each}
	</ul>
</section>
