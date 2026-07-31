<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- role="alert" : l'erreur est vocalisée dès son apparition par les lecteurs d'écran. -->
<p role="alert" class="text-sm text-red-600">{@render children()}</p>
