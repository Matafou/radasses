<script lang="ts">
	let {
		value = $bindable(''),
		class: className = '',
		disabled = false,
		...rest
	}: {
		value?: string;
		class?: string;
		disabled?: boolean;
		[key: string]: unknown;
	} = $props();
</script>

<input
	bind:value
	{disabled}
	class="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400 {className}"
	{...rest}
/>
