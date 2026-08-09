<script lang="ts">
	// Feuille de partage réutilisable : canaux explicites (Web Share natif si dispo,
	// e-mail, SMS, copier). Mutualise ce qui était dupliqué entre le partage d'un lien
	// participant et le partage du lien de séjour (et réutilisable pour d'autres liens :
	// rubrique « liens d'accès », recovery bundle). L'appelant fournit juste le message
	// (`subject`/`text`) et l'`url` ; les canaux et la copie sont gérés ici.
	// Lucide icons: ISC license, see THIRD_PARTY_NOTICES.md.
	import { Check, Link, Mail, MessageSquare, Share2 } from '@lucide/svelte';
	import { Alert, BottomSheet } from '$lib/components/ui';
	import { createFlash } from '$lib/flash.svelte';

	let {
		open,
		onClose,
		title,
		subject,
		text,
		url,
		warning
	}: {
		open: boolean;
		onClose: () => void;
		title: string;
		/** objet de l'e-mail + titre du partage natif */
		subject: string;
		/** message amical (sans l'URL ; le natif porte l'URL à part) */
		text: string;
		url: string;
		/** avertissement optionnel (le lien = crédential) */
		warning?: string;
	} = $props();

	const canNativeShare = $derived(
		typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);
	const channelClass =
		'flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50';
	// mailto/sms sont du texte brut → on y inclut le lien ; Web Share porte l'URL à part.
	const body = $derived(`${text}\n${url}`);
	const mailtoHref = $derived(
		`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
	);
	// `sms:?&body=` : forme acceptée par iOS ET Android (sans destinataire).
	const smsHref = $derived(`sms:?&body=${encodeURIComponent(body)}`);
	const copied = createFlash();

	async function nativeShare() {
		try {
			await navigator.share({ title: subject, text, url });
			onClose();
		} catch {
			/* partage annulé ou indisponible */
		}
	}
	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			copied.trigger();
		} catch {
			/* clipboard indispo */
		}
	}
</script>

<BottomSheet {open} {title} {onClose}>
	<div class="space-y-2 pb-2">
		{#if canNativeShare}
			<button type="button" class={channelClass} onclick={nativeShare}>
				<Share2 size={18} class="shrink-0" aria-hidden="true" />
				Partager…
			</button>
		{/if}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- schéma mailto: (pas une route) -->
		<a class={channelClass} href={mailtoHref}>
			<Mail size={18} class="shrink-0" aria-hidden="true" />
			E-mail
		</a>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- schéma sms: (pas une route) -->
		<a class={channelClass} href={smsHref}>
			<MessageSquare size={18} class="shrink-0" aria-hidden="true" />
			SMS
		</a>
		<button type="button" class={channelClass} onclick={copy}>
			{#if copied.on}
				<Check size={18} class="shrink-0 text-emerald-600" aria-hidden="true" />
				Lien copié
			{:else}
				<Link size={18} class="shrink-0" aria-hidden="true" />
				Copier le lien
			{/if}
		</button>
		{#if warning}
			<Alert tone="warning" class="p-2 text-xs">{warning}</Alert>
		{/if}
	</div>
</BottomSheet>
