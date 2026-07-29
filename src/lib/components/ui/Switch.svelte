<script lang="ts">
	let {
		checked = $bindable(false),
		label,
		class: className = '',
		...rest
	}: {
		checked?: boolean;
		label: string;
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {checked
		? 'bg-emerald-600'
		: 'bg-slate-300'} {className}"
	{...rest}
>
	<span
		class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {checked
			? 'translate-x-4'
			: 'translate-x-0.5'}"
	></span>
</button>
