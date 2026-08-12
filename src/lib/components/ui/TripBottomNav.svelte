<script lang="ts">
	import { base, resolve } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { Pencil, Plus, Receipt, Scale, Users } from '@lucide/svelte';
	import Fab from './Fab.svelte';

	let {
		tripId,
		path,
		showFab = false,
		fabDisabled = false,
		hasDraft = false,
		onAdd
	}: {
		tripId: string;
		path: string;
		showFab?: boolean;
		fabDisabled?: boolean;
		hasDraft?: boolean;
		onAdd: () => void;
	} = $props();

	// « Actif » calculé de façon UNIFORME pour tous les onglets : on compare le chemin
	// courant (base retirée, slash final normalisé) à `/t/{tripId}{sub}`. Aucun cas
	// particulier pour l'index — c'était la source du bug (l'index comparait sans le base,
	// les sous-onglets s'en sortaient par chance avec un `endsWith`).
	const rel = $derived(path.replace(/\/+$/, '').slice(base.length));
	const isActive = (sub: string) => rel === `/t/${tripId}${sub}`;
</script>

<nav class="flex-none border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
	<div class="relative mx-auto grid h-(--bar-h) max-w-app grid-cols-3">
		<a
			href={resolve('/t/[tripId]', { tripId })}
			class="trip-tab"
			title="Dépenses"
			aria-current={isActive('') ? 'page' : undefined}
		>
			<Receipt size={20} aria-hidden="true" />
			<span>Dépenses</span>
		</a>
		<a
			href={resolve('/t/[tripId]/soldes', { tripId })}
			class="trip-tab"
			title="Soldes"
			aria-current={isActive('/soldes') ? 'page' : undefined}
		>
			<Scale size={20} aria-hidden="true" />
			<span>Soldes</span>
		</a>
		<a
			href={resolve('/t/[tripId]/participants', { tripId })}
			class="trip-tab"
			title="Participants"
			aria-current={isActive('/participants') ? 'page' : undefined}
		>
			<Users size={20} aria-hidden="true" />
			<span>Participants</span>
		</a>

		{#if showFab}
			{#if hasDraft}
				<Fab
					icon={Pencil}
					label="Reprendre la saisie en cours"
					variant="warning"
					class="absolute bottom-full left-(--fab-x) z-(--z-fab) -mb-2 -translate-x-1/2"
					disabled={fabDisabled}
					onclick={onAdd}
				/>
			{:else}
				<Fab
					icon={Plus}
					label="Ajouter une dépense"
					class="absolute bottom-full left-(--fab-x) z-(--z-fab) -mb-2 -translate-x-1/2"
					disabled={fabDisabled}
					onclick={onAdd}
				/>
			{/if}
		{/if}
	</div>
</nav>
