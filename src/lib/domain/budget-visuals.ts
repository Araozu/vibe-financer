export const DEFAULT_BUDGET_ICON = 'piggy-bank';
export const DEFAULT_BUDGET_COLOR = '#ff3b6b';

export type BudgetIconKey =
	| 'piggy-bank'
	| 'utensils'
	| 'shopping-bag'
	| 'car'
	| 'home'
	| 'receipt'
	| 'heart-pulse'
	| 'gamepad-2'
	| 'plane'
	| 'book-open'
	| 'shirt'
	| 'dumbbell'
	| 'gift'
	| 'paw-print'
	| 'tag';

export interface BudgetIconOption {
	key: BudgetIconKey;
	label: string;
}

export const BUDGET_ICON_OPTIONS: BudgetIconOption[] = [
	{ key: 'piggy-bank', label: 'Savings' },
	{ key: 'utensils', label: 'Food' },
	{ key: 'shopping-bag', label: 'Shopping' },
	{ key: 'car', label: 'Transport' },
	{ key: 'home', label: 'Home' },
	{ key: 'receipt', label: 'Bills' },
	{ key: 'heart-pulse', label: 'Health' },
	{ key: 'gamepad-2', label: 'Fun' },
	{ key: 'plane', label: 'Travel' },
	{ key: 'book-open', label: 'Education' },
	{ key: 'shirt', label: 'Clothes' },
	{ key: 'dumbbell', label: 'Fitness' },
	{ key: 'gift', label: 'Gifts' },
	{ key: 'paw-print', label: 'Pets' },
	{ key: 'tag', label: 'Other' }
];

export const BUDGET_COLOR_OPTIONS = [
	'#ff3b6b',
	'#f97316',
	'#eab308',
	'#22c55e',
	'#14b8a6',
	'#3b82f6',
	'#8b5cf6',
	'#ec4899',
	'#64748b'
] as const;

export function normalizeBudgetIcon(value: string | null | undefined): BudgetIconKey {
	return (
		BUDGET_ICON_OPTIONS.find((option) => option.key === value)?.key ?? DEFAULT_BUDGET_ICON
	);
}

export function normalizeBudgetColor(value: string | null | undefined): string {
	const trimmed = value?.trim() ?? '';
	return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : DEFAULT_BUDGET_COLOR;
}
