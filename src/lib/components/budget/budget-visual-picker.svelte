<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import BudgetIcon from './budget-icon.svelte';
	import {
		BUDGET_COLOR_OPTIONS,
		BUDGET_ICON_OPTIONS,
		DEFAULT_BUDGET_COLOR,
		DEFAULT_BUDGET_ICON,
		normalizeBudgetColor,
		normalizeBudgetIcon
	} from '$lib/domain/budget-visuals';

	let {
		icon = $bindable(DEFAULT_BUDGET_ICON),
		color = $bindable(DEFAULT_BUDGET_COLOR),
		idPrefix = 'budget-visual'
	}: {
		icon?: string;
		color?: string;
		idPrefix?: string;
	} = $props();

	const selectedIcon = $derived(normalizeBudgetIcon(icon));
	const selectedColor = $derived(normalizeBudgetColor(color));

	function selectIcon(value: string) {
		icon = normalizeBudgetIcon(value);
	}

	function selectColor(value: string) {
		color = normalizeBudgetColor(value);
	}
</script>

<div class="space-y-4">
	<div class="space-y-2">
		<Label>Icon</Label>
		<div class="grid grid-cols-5 gap-2">
			{#each BUDGET_ICON_OPTIONS as option (option.key)}
				<button
					type="button"
					class="flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] transition-colors hover:bg-accent {selectedIcon === option.key ? 'border-primary bg-accent text-foreground' : 'border-border text-muted-foreground'}"
					onclick={() => selectIcon(option.key)}
					aria-pressed={selectedIcon === option.key}
				>
					<BudgetIcon icon={option.key} {color} size="sm" />
					<span class="w-full truncate">{option.label}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="space-y-2">
		<Label>Color</Label>
		<div class="flex flex-wrap gap-2">
			{#each BUDGET_COLOR_OPTIONS as option (option)}
				<button
					type="button"
					class="h-8 w-8 rounded-full border-2 transition-transform hover:scale-105 {selectedColor === option ? 'border-foreground' : 'border-transparent'}"
					style="background-color: {option}"
					onclick={() => selectColor(option)}
					aria-label={`Select ${option}`}
					aria-pressed={selectedColor === option}
				></button>
			{/each}
		</div>
	</div>

	<input type="hidden" id={`${idPrefix}-icon`} name="icon" value={selectedIcon} />
	<input type="hidden" id={`${idPrefix}-color`} name="color" value={selectedColor} />
</div>
