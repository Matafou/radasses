<script lang="ts">
	import { base, resolve } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowLeft, Settings } from '@lucide/svelte';
	import { fitText } from '$lib/actions/fitText';

	let {
		tripId,
		title,
		settingsActive = false
	}: {
		tripId: string;
		title: string;
		settingsActive?: boolean;
	} = $props();
</script>

<header class="flex-none border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
	<div class="relative flex h-(--bar-h) items-center px-4">
		<a
			href={resolve('/')}
			aria-label="Retour aux séjours"
			title="Séjours"
			class="relative shrink-0 text-slate-400 hover:text-slate-600"
		>
			<ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
		</a>
		<!-- Favicon décoratif centré dans la barre (absolu → n'affecte PAS la hauteur). -->
		<img
			src="{base}/favicon.png"
			alt=""
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 left-1/2 h-(--bar-h) w-(--bar-h) -translate-x-1/2 -translate-y-1/2"
		/>
		<!-- Titre + roue à droite ; le titre est borné (pour ne pas chevaucher le
		     favicon central, large de --bar-h) et sa police se réduit via `fitText`. -->
		<div class="relative ml-auto flex max-w-[calc(50%-2.25rem)] min-w-0 items-center gap-3">
			<h1 use:fitText={title} class="min-w-0 truncate text-lg font-semibold">{title}</h1>
			<a
				href={resolve('/t/[tripId]/reglages', { tripId })}
				aria-label="Réglages"
				title="Réglages"
				class="shrink-0 hover:text-slate-600 {settingsActive ? 'text-slate-900' : 'text-slate-400'}"
			>
				<Settings size={20} strokeWidth={1.8} aria-hidden="true" />
			</a>
		</div>
	</div>
</header>
