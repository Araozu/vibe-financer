<script lang="ts">
	import {
		BookOpen,
		Car,
		Dumbbell,
		Gamepad2,
		Gift,
		HeartPulse,
		Home,
		PawPrint,
		PiggyBank,
		Plane,
		Receipt,
		Shirt,
		ShoppingBag,
		Tag,
		Utensils
	} from '@lucide/svelte';
	import {
		DEFAULT_BUDGET_COLOR,
		DEFAULT_BUDGET_ICON,
		normalizeBudgetColor,
		normalizeBudgetIcon,
		type BudgetIconKey
	} from '$lib/domain/budget-visuals';

	const icons: Record<BudgetIconKey, typeof PiggyBank> = {
		'piggy-bank': PiggyBank,
		utensils: Utensils,
		'shopping-bag': ShoppingBag,
		car: Car,
		home: Home,
		receipt: Receipt,
		'heart-pulse': HeartPulse,
		'gamepad-2': Gamepad2,
		plane: Plane,
		'book-open': BookOpen,
		shirt: Shirt,
		dumbbell: Dumbbell,
		gift: Gift,
		'paw-print': PawPrint,
		tag: Tag
	};

	let {
		icon = DEFAULT_BUDGET_ICON,
		color = DEFAULT_BUDGET_COLOR,
		size = 'md',
		class: className = ''
	}: {
		icon?: string | null;
		color?: string | null;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	} = $props();

	const normalizedIcon = $derived(normalizeBudgetIcon(icon));
	const normalizedColor = $derived(normalizeBudgetColor(color));
	const Icon = $derived(icons[normalizedIcon] ?? icons[DEFAULT_BUDGET_ICON]);
	const sizeClass = $derived(
		size === 'sm'
			? 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4'
			: size === 'lg'
				? 'h-14 w-14 [&_svg]:h-7 [&_svg]:w-7'
				: 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5'
	);
</script>

<div
	class="flex shrink-0 items-center justify-center rounded-full {sizeClass} {className}"
	style="background-color: {normalizedColor}18; color: {normalizedColor}"
>
	<Icon />
</div>
