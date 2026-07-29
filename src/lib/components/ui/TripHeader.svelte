<script lang="ts">
	import { resolve } from '$app/paths';
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { ArrowLeft, Settings } from '@lucide/svelte';

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

<header class="flex-none border-b border-slate-200 bg-white">
	<div class="flex items-center gap-3 px-4 py-3">
		<a
			href={resolve('/')}
			aria-label="Retour aux séjours"
			title="Séjours"
			class="shrink-0 text-slate-400 hover:text-slate-600"
		>
			<ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
		</a>
		<h1 class="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
		<a
			href={resolve('/t/[tripId]/reglages', { tripId })}
			aria-label="Réglages"
			title="Réglages"
			class="shrink-0 hover:text-slate-600 {settingsActive ? 'text-slate-900' : 'text-slate-400'}"
		>
			<Settings size={20} strokeWidth={1.8} aria-hidden="true" />
		</a>
	</div>
</header>
