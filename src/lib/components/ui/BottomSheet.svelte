<script lang="ts">
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ChevronDown } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import { focusAutofocusTarget } from '$lib/actions/autofocus';

	let {
		children,
		open,
		closeLabel = 'Fermer',
		onClose,
		class: className = ''
	}: {
		children: Snippet;
		open: boolean;
		closeLabel?: string;
		onClose: () => void;
		class?: string;
	} = $props();

	let sheet = $state<HTMLElement>();
	// À l'ouverture, place le focus dans le 1er champ (desktop only, cf. action).
	$effect(() => {
		if (open && sheet) focusAutofocusTarget(sheet);
	});
</script>

{#if open}
	<button
		type="button"
		aria-label={closeLabel}
		onclick={onClose}
		class="fixed inset-0 z-(--z-backdrop) bg-black/30"
	></button>
{/if}

<div
	bind:this={sheet}
	class="fixed inset-x-0 bottom-0 z-(--z-sheet) mx-auto max-w-sheet rounded-t-2xl bg-white shadow-xl transition-transform duration-(--sheet-duration) {open
		? 'translate-y-0'
		: 'pointer-events-none translate-y-full'} {className}"
>
	<div class="max-h-(--sheet-max-h) overflow-y-auto p-3">
		<div class="relative mb-2 flex h-6 items-center justify-center">
			<div class="h-1 w-10 rounded-full bg-slate-300"></div>
			<IconButton
				icon={ChevronDown}
				label={closeLabel}
				title={closeLabel}
				class="absolute right-0"
				onclick={onClose}
			/>
		</div>
		{@render children()}
	</div>
</div>
