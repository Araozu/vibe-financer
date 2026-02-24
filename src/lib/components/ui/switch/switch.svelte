<script lang="ts">
	import { Switch as SwitchPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		checked = $bindable(false),
		...restProps
	}: WithoutChildrenOrChild<SwitchPrimitive.RootProps> = $props();
</script>

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	data-slot="switch"
	class={cn(
		'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border/40 shadow-[0_1px_3px_rgba(0,0,0,0.15)_inset] transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-linear-to-b data-[state=checked]:from-primary/90 data-[state=checked]:to-primary data-[state=unchecked]:bg-linear-to-b data-[state=unchecked]:from-muted/60 data-[state=unchecked]:to-muted/40 dark:data-[state=unchecked]:from-muted/30 dark:data-[state=unchecked]:to-muted/10',
		className
	)}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class={cn(
			'pointer-events-none block size-4 rounded-full bg-linear-to-b from-white to-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_1px_0_rgba(255,255,255,1)_inset] transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0.5 dark:from-zinc-200 dark:to-zinc-400 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.2)_inset]'
		)}
	/>
</SwitchPrimitive.Root>
