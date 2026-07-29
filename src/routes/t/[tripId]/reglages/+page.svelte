<script lang="ts">
	import { getTripState } from '$lib/trip.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextInput from '$lib/components/ui/TextInput.svelte';

	const tripState = getTripState();

	let name = $state(tripState.trip?.name ?? '');
	let currency = $state(tripState.trip?.currency ?? 'EUR');
	let saving = $state(false);
	let saved = $state(false);
	let error = $state<string | null>(null);

	const base = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'SEK', 'AUD'];
	const currencies = $derived(base.includes(currency) ? base : [currency, ...base]);

	async function onSave(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		saved = false;
		if (!name.trim()) return void (error = 'Nom requis.');
		saving = true;
		try {
			await tripState.updateSettings({ name: name.trim(), currency });
			saved = true;
			setTimeout(() => (saved = false), 1500);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<section class="space-y-3">
	<h2 class="text-sm font-medium text-slate-500">Réglages du séjour</h2>
	<Card>
		<form class="space-y-3" onsubmit={onSave}>
			<label class="block text-sm text-slate-600">
				Nom du séjour
				<TextInput class="mt-1 w-full" bind:value={name} />
			</label>
			<label class="block text-sm text-slate-600">
				Devise
				<Select class="mt-1 w-full" bind:value={currency}>
					{#each currencies as c (c)}
						<option value={c}>{c}</option>
					{/each}
				</Select>
			</label>
			{#if error}
				<p class="text-sm text-red-600">{error}</p>
			{/if}
			<Button type="submit" class="w-full" disabled={saving}>
				{saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
			</Button>
		</form>
	</Card>
</section>
