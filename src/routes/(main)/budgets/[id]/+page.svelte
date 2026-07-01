<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		ArrowLeft,
		CalendarDays,
		CircleDollarSign,
		Loader2,
		Pencil,
		PiggyBank
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import TransactionsTable from '$lib/components/transaction/transactions-table.svelte';
	import BudgetIcon from '$lib/components/budget/budget-icon.svelte';
	import BudgetVisualPicker from '$lib/components/budget/budget-visual-picker.svelte';
	import { formatLocalDate } from '$lib/domain/date-formatter';
	import { DEFAULT_BUDGET_COLOR, DEFAULT_BUDGET_ICON } from '$lib/domain/budget-visuals';
	import {
		DASHBOARD_MONTHS,
		getDashboardPeriodContext
	} from '$lib/components/layout/dashboard-period.js';

	type SerializedBudget = {
		id: string;
		userId: string;
		category: string;
		limit: number;
		currencyId: string;
		icon: string;
		color: string;
		period: 'monthly' | 'weekly' | 'yearly';
		startDate: string;
		currentSpent: number;
		periodSpent: number;
		periodStart: string;
		periodEnd: string;
		createdAt: string;
		updatedAt: string;
		currencyCode: string | null;
		currencySymbol: string | null;
	};

	let { data } = $props();
	const queryClient = useQueryClient();
	const budget = $derived(data.budget as SerializedBudget);
	const accounts = $derived(data.accounts ?? []);
	const initialTransactions = $derived(data.initialTransactions ?? []);
	const dashboardPeriod = getDashboardPeriodContext();
	let selectedMonth = $derived(dashboardPeriod.month);
	let selectedYear = $derived(dashboardPeriod.year);

	let editOpen = $state(false);
	let editCategory = $state('');
	let editIcon = $state(DEFAULT_BUDGET_ICON);
	let editColor = $state(DEFAULT_BUDGET_COLOR);
	let editLimitStr = $state('');
	let editPeriod = $state<'monthly' | 'weekly' | 'yearly'>('monthly');
	let editStartDate = $state('');
	let isUpdating = $state(false);

	const periods = [
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'yearly', label: 'Yearly' }
	];

	const budgetQuery = createQuery<SerializedBudget>(() => ({
		queryKey: [
			'budgets',
			budget.id,
			selectedMonth,
			selectedYear,
			Intl.DateTimeFormat().resolvedOptions().timeZone
		],
		queryFn: async () => {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const res = await fetch(`/api/budgets?month=${selectedMonth}&year=${selectedYear}&tz=${tz}`);
			const budgets = (await res.json()) as SerializedBudget[];
			return budgets.find((item) => item.id === budget.id) ?? budget;
		}
	}));

	const visibleBudget = $derived(budgetQuery.data ?? budget);
	const spent = $derived(visibleBudget.periodSpent ?? visibleBudget.currentSpent ?? 0);
	const remaining = $derived(visibleBudget.limit - spent);
	const percentSpent = $derived(
		visibleBudget.limit > 0 ? Math.round((spent / visibleBudget.limit) * 100) : 0
	);
	const progressValue = $derived(visibleBudget.limit > 0 ? Math.min(percentSpent, 100) : 0);

	function formatAmount(amount: number) {
		const formatted = (Math.abs(amount) / 100).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		return `${visibleBudget.currencySymbol ?? '$'}${formatted}`;
	}

	async function fetchBudgetTransactionsPage(params: {
		limit: number;
		offset: number;
		search: string;
		type: 'all' | 'income' | 'expense' | 'transfer';
		startDate: string;
		endDate: string;
		category: string;
		accountId: string;
	}) {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const queryParams = [
			`limit=${encodeURIComponent(params.limit.toString())}`,
			`offset=${encodeURIComponent(params.offset.toString())}`,
			`month=${encodeURIComponent(selectedMonth.toString())}`,
			`year=${encodeURIComponent(selectedYear.toString())}`,
			`tz=${encodeURIComponent(tz)}`,
			...(params.search ? [`search=${encodeURIComponent(params.search)}`] : []),
			...(params.accountId ? [`accountId=${encodeURIComponent(params.accountId)}`] : [])
		].join('&');

		const res = await fetch(`/api/budgets/${visibleBudget.id}/transactions?${queryParams}`);
		return await res.json();
	}

	$effect(() => {
		if (editOpen) {
			editCategory = visibleBudget.category;
			editIcon = visibleBudget.icon ?? DEFAULT_BUDGET_ICON;
			editColor = visibleBudget.color ?? DEFAULT_BUDGET_COLOR;
			editLimitStr = (visibleBudget.limit / 100).toFixed(2);
			editPeriod = visibleBudget.period;
			editStartDate = new Date(visibleBudget.startDate).toISOString().slice(0, 10);
		}
	});
</script>

<svelte:head>
	<title>{visibleBudget.category} Budget - {DASHBOARD_MONTHS[selectedMonth]} {selectedYear}</title>
</svelte:head>

<div class="space-y-8">
	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		<a href="/budgets" class="flex items-center gap-1 transition-colors hover:text-foreground">
			<ArrowLeft class="h-3.5 w-3.5" />
			Budgets
		</a>
		<span class="text-muted-foreground/40">/</span>
		<span class="font-medium text-foreground">{visibleBudget.category}</span>
	</div>

	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div class="flex items-center gap-4">
			<BudgetIcon icon={visibleBudget.icon} color={visibleBudget.color} size="lg" class="rounded-2xl" />
			<div>
				<h1 class="text-2xl font-bold">{visibleBudget.category}</h1>
				<div class="flex items-center gap-2 text-sm">
					<span class="font-medium text-primary capitalize">{visibleBudget.period} limit</span>
					<span class="text-muted-foreground">{visibleBudget.currencyCode ?? 'USD'}</span>
				</div>
			</div>
		</div>

		<Button type="button" variant="outline" onclick={() => (editOpen = true)}>
			<Pencil class="mr-2 h-4 w-4" />
			Edit
		</Button>
	</div>

	<div class="grid gap-4 md:grid-cols-4">
		<Card.Root>
			<Card.Content class="p-4">
				<div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
					<CircleDollarSign class="h-3.5 w-3.5 text-primary" />
					Limit
				</div>
				<p class="text-xl font-bold">{formatAmount(visibleBudget.limit)}</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="p-4">
				<div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
					<PiggyBank class="h-3.5 w-3.5 text-primary" />
					Spent this period
				</div>
				<p class="text-xl font-bold">{formatAmount(spent)}</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="p-4">
				<div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
					<CircleDollarSign
						class="h-3.5 w-3.5 {remaining < 0 ? 'text-rose-500' : 'text-primary'}"
					/>
					{remaining < 0 ? 'Over budget' : 'Remaining'}
				</div>
				<p class="text-xl font-bold {remaining < 0 ? 'text-rose-500' : ''}">
					{formatAmount(remaining)}
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="p-4">
				<div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
					<CalendarDays class="h-3.5 w-3.5 text-primary" />
					Period
				</div>
				<p class="text-sm font-medium">
					{formatLocalDate(visibleBudget.periodStart)} - {formatLocalDate(visibleBudget.periodEnd)}
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Progress</Card.Title>
			<Card.Description>
				{DASHBOARD_MONTHS[selectedMonth]}
				{selectedYear}
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-2">
			<Progress value={progressValue} class="h-3" />
			<div class="flex justify-between text-xs text-muted-foreground">
				<span>{percentSpent}% spent</span>
				{#if spent > visibleBudget.limit}
					<span class="font-medium text-rose-500"
						>Over budget by {formatAmount(spent - visibleBudget.limit)}</span
					>
				{:else}
					<span>{formatAmount(visibleBudget.limit - spent)} remaining</span>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<TransactionsTable
		title="Budget transactions"
		{initialTransactions}
		{accounts}
		queryKeyBase={['budgets', visibleBudget.id]}
		fetchPage={fetchBudgetTransactionsPage}
		invalidateQueryKeys={[['budgets'], ['accounts']]}
		showTypeFilter={true}
		showTimeframeFilter={true}
		showCategoryFilter={false}
		emptyMessage="No transactions counted toward this budget for this period."
		filteredEmptyMessage="No transactions counted toward this budget match the current filters."
	/>
</div>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit budget</Dialog.Title>
			<Dialog.Description>
				Update the category, limit, period, or start date. Currency cannot be changed.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				isUpdating = true;
				return async ({ result }) => {
					isUpdating = false;
					if (result.type === 'success') {
						await queryClient.invalidateQueries({ queryKey: ['budgets'] });
						await queryClient.invalidateQueries({ queryKey: ['budgets', visibleBudget.id] });
						await invalidateAll();
						editOpen = false;
						toast.success('Budget updated');
					} else if (result.type === 'failure') {
						const msg =
							typeof result.data?.error === 'string'
								? result.data.error
								: 'Failed to update budget';
						toast.error(msg);
					}
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="budgetId" value={visibleBudget.id} />
			<div class="space-y-2">
				<Label>Currency</Label>
				<p class="text-sm text-muted-foreground">
					{visibleBudget.currencyCode ?? 'Unknown'}{visibleBudget.currencySymbol
						? ` (${visibleBudget.currencySymbol})`
						: ''}
				</p>
			</div>
			<div class="space-y-2">
				<Label for="edit-category">Category</Label>
				<Input id="edit-category" name="category" bind:value={editCategory} required />
			</div>
			<BudgetVisualPicker bind:icon={editIcon} bind:color={editColor} idPrefix="edit-budget-detail" />
			<div class="space-y-2">
				<Label for="edit-limit">Limit</Label>
				<div class="relative">
					<span class="absolute top-2.5 left-3 text-muted-foreground">$</span>
					<Input
						id="edit-limit"
						name="limit"
						type="number"
						step="0.01"
						class="pl-7"
						bind:value={editLimitStr}
						required
					/>
				</div>
			</div>
			<div class="space-y-2">
				<Label for="edit-period">Period</Label>
				<Select.Root type="single" bind:value={editPeriod} name="period">
					<Select.Trigger id="edit-period">
						{periods.find((p) => p.value === editPeriod)?.label ?? 'Select period'}
					</Select.Trigger>
					<Select.Content>
						{#each periods as period (period.value)}
							<Select.Item value={period.value}>{period.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-2">
				<Label for="edit-start">Start date</Label>
				<Input id="edit-start" name="startDate" type="date" bind:value={editStartDate} required />
			</div>
			<Dialog.Footer class="gap-2 sm:gap-0">
				<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={isUpdating}>
					{#if isUpdating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Saving...
					{:else}
						Save changes
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
