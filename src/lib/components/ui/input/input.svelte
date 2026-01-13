<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const inputVariants = tv({
		base: "selection:bg-primary selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border-input",
		variants: {
			variant: {
				default: "bg-background dark:bg-input/30",
				background: "bg-background",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type InputVariant = VariantProps<typeof inputVariants>["variant"];
</script>

<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	> & {
		variant?: InputVariant;
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		variant = "default",
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			inputVariants({ variant }),
			"px-3 pt-1.5 text-sm font-medium",
			variant === "default" && "bg-transparent",
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(inputVariants({ variant }), "px-3 py-1 text-base md:text-sm", className)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
