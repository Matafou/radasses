<script lang="ts">
	import { resolve } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { Pencil, Plus } from '@lucide/svelte';
	import Fab from './Fab.svelte';

	let {
		tripId,
		path,
		showFab = false,
		hasDraft = false,
		onAdd
	}: {
		tripId: string;
		path: string;
		showFab?: boolean;
		hasDraft?: boolean;
		onAdd: () => void;
	} = $props();

	function isActive(suffix: string): boolean {
		if (suffix === '') return path === `/t/${tripId}` || path === `/t/${tripId}/`;
		return path.endsWith(`/${suffix}`);
	}

	function tabClass(active: boolean): string {
		return `py-3 text-center text-xs ${active ? 'font-semibold text-slate-900' : 'text-slate-400'}`;
	}
</script>

<nav class="flex-none border-t border-slate-200 bg-white">
	<div class="relative mx-auto grid max-w-md grid-cols-4">
		<a href={resolve('/t/[tripId]', { tripId })} class={tabClass(isActive(''))}>Dépenses</a>
		<a href={resolve('/t/[tripId]/soldes', { tripId })} class={tabClass(isActive('soldes'))}
			>Soldes</a
		>
		<a
			href={resolve('/t/[tripId]/participants', { tripId })}
			class={tabClass(isActive('participants'))}>Participants</a
		>
		<a href={resolve('/t/[tripId]/journal', { tripId })} class={tabClass(isActive('journal'))}
			>Journal</a
		>

		{#if showFab}
			{#if hasDraft}
				<Fab
					icon={Pencil}
					label="Reprendre la saisie en cours"
					variant="warning"
					class="absolute bottom-full left-[12.5%] z-20 -mb-2 -translate-x-1/2"
					onclick={onAdd}
				/>
			{:else}
				<Fab
					icon={Plus}
					label="Ajouter une dépense"
					class="absolute bottom-full left-[12.5%] z-20 -mb-2 -translate-x-1/2"
					onclick={onAdd}
				/>
			{/if}
		{/if}
	</div>
</nav>
