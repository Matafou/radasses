<script lang="ts">
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ChevronDown } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import { focusAutofocusTarget } from '$lib/actions/autofocus';

	let {
		children,
		open,
		title,
		closeLabel = 'Fermer',
		onClose,
		class: className = ''
	}: {
		children: Snippet;
		open: boolean;
		/** Titre du dialogue (nom accessible + en-tête visible). */
		title: string;
		closeLabel?: string;
		onClose: () => void;
		class?: string;
	} = $props();

	const titleId = `sheet-title-${crypto.randomUUID()}`;
	let sheet = $state<HTMLElement>();
	let previouslyFocused: HTMLElement | null = null;

	// Boîte de dialogue accessible : à l'ouverture on mémorise l'élément déclencheur
	// et on déplace le focus DANS le dialogue — le champ `data-autofocus` sur desktop,
	// sinon le conteneur (le lecteur d'écran annonce alors « dialogue, <titre> » sans
	// faire surgir le clavier). À la fermeture, on rend le focus au déclencheur (s'il
	// est encore dans le DOM — le FAB « + » disparaît, dans ce cas on ne fait rien).
	$effect(() => {
		if (open) {
			previouslyFocused = document.activeElement as HTMLElement | null;
			queueMicrotask(() => {
				if (open && sheet && !focusAutofocusTarget(sheet)) sheet.focus();
			});
		} else if (previouslyFocused) {
			const prev = previouslyFocused;
			previouslyFocused = null;
			if (document.contains(prev)) prev.focus();
		}
	});

	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	// Échap ferme ; Tab est piégé à l'intérieur du dialogue (ne s'échappe pas vers
	// la page derrière). `aria-modal` complète côté lecteurs d'écran.
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key !== 'Tab' || !sheet) return;
		const els = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
			(el) => el.offsetParent !== null
		);
		if (!els.length) return;
		const first = els[0];
		const last = els[els.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || active === sheet)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

{#if open}
	<!-- Fond : ferme au clic ; masqué aux technologies d'assistance (dialogue modal)
	     et hors tabulation. -->
	<button
		type="button"
		aria-hidden="true"
		tabindex="-1"
		onclick={onClose}
		class="fixed inset-0 z-(--z-backdrop) bg-black/30"
	></button>
{/if}

<div
	bind:this={sheet}
	role="dialog"
	aria-modal="true"
	aria-labelledby={titleId}
	tabindex="-1"
	inert={!open}
	onkeydown={onKeydown}
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
		<h2 id={titleId} class="mb-2 text-sm font-medium text-slate-600">{title}</h2>
		{@render children()}
	</div>
</div>
