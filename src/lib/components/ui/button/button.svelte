<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { type VariantProps, tv } from 'tailwind-variants';

	export const buttonVariants = tv({
		base: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 active:scale-[0.98] active:translate-y-[1px]",
		variants: {
			variant: {
				default: 'bg-linear-to-b from-primary/90 to-primary text-primary-foreground border-b-2 border-primary/70 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_4px_rgba(0,0,0,0.1)] hover:brightness-110 active:shadow-inner active:border-b-0',
				destructive:
					'bg-linear-to-b from-destructive/90 to-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-white border-b-2 border-destructive/70 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_4px_rgba(0,0,0,0.1)] hover:brightness-110 active:shadow-inner active:border-b-0',
				outline:
					'bg-linear-to-b from-background to-accent/10 hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 border border-b-2 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_1px_2px_rgba(0,0,0,0.05)] active:border-b active:shadow-inner',
				secondary: 'bg-linear-to-b from-secondary/90 to-secondary text-secondary-foreground border-b-2 border-secondary/70 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_4px_rgba(0,0,0,0.1)] hover:brightness-110 active:shadow-inner active:border-b-0',
				ghost: 'hover:bg-linear-to-b hover:from-accent/20 hover:to-accent/50 hover:text-accent-foreground dark:hover:bg-accent/30 border-transparent hover:border-accent/20 border-b-2 hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_1px_2px_rgba(0,0,0,0.05)] active:bg-accent/60 active:shadow-inner active:border-b-0 transition-all',
				link: 'text-primary underline-offset-4 hover:underline'
			},
			size: {
				default: 'h-9 px-4 py-2 has-[>svg]:px-3',
				sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
				lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
				icon: 'size-9',
				'icon-sm': 'size-8',
				'icon-lg': 'size-10'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
