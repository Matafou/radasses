<script lang="ts">
	let {
		text = 'Chargement…',
		class: className = ''
	}: {
		text?: string;
		class?: string;
	} = $props();
</script>

<p class="text-slate-400 {className}">{text}</p>
