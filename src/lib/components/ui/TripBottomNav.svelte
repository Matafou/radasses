<script lang="ts">
	import { resolve } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { Pencil, Plus, Receipt, Scale, Users } from '@lucide/svelte';
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
		return `flex flex-col items-center justify-center gap-0.5 text-[0.8rem] leading-none ${active ? 'font-semibold text-slate-900' : 'text-slate-400'}`;
	}
</script>

<nav class="flex-none border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
	<div class="relative mx-auto grid h-(--bar-h) max-w-app grid-cols-3">
		<a
			href={resolve('/t/[tripId]', { tripId })}
			class={tabClass(isActive(''))}
			title="Dépenses"
			aria-current={isActive('') ? 'page' : undefined}
		>
			<Receipt size={20} aria-hidden="true" />
			<span>Dépenses</span>
		</a>
		<a
			href={resolve('/t/[tripId]/soldes', { tripId })}
			class="{tabClass(isActive('soldes'))} border-l border-slate-200"
			title="Soldes"
			aria-current={isActive('soldes') ? 'page' : undefined}
		>
			<Scale size={20} aria-hidden="true" />
			<span>Soldes</span>
		</a>
		<a
			href={resolve('/t/[tripId]/participants', { tripId })}
			class="{tabClass(isActive('participants'))} border-l border-slate-200"
			title="Participants"
			aria-current={isActive('participants') ? 'page' : undefined}
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
					onclick={onAdd}
				/>
			{:else}
				<Fab
					icon={Plus}
					label="Ajouter une dépense"
					class="absolute bottom-full left-(--fab-x) z-(--z-fab) -mb-2 -translate-x-1/2"
					onclick={onAdd}
				/>
			{/if}
		{/if}
	</div>
</nav>
