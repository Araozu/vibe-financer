<script lang="ts">
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		sideOffset = 4,
		portalProps,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		class={cn(
			'z-50 max-h-(--bits-dropdown-menu-content-available-height) min-w-[8rem] origin-(--bits-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-border/40 bg-popover/95 p-1 text-popover-foreground shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3),0_1px_0_0_rgba(255,255,255,0.1)_inset] backdrop-blur-md outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2 data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5),0_1px_0_0_rgba(255,255,255,0.05)_inset]',
			className
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
