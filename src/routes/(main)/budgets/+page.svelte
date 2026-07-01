<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Plus, PiggyBank, Globe, Pencil, Loader2 } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { toast } from 'svelte-sonner';
	import BudgetIcon from '$lib/components/budget/budget-icon.svelte';
	import BudgetVisualPicker from '$lib/components/budget/budget-visual-picker.svelte';
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
		createdAt: string;
		updatedAt: string;
		currencyCode: string | null;
		currencySymbol: string | null;
	};

	const queryClient = useQueryClient();
	const dashboardPeriod = getDashboardPeriodContext();
	let selectedMonth = $derived(dashboardPeriod.month);
	let selectedYear = $derived(dashboardPeriod.year);

	const budgetsQuery = createQuery<SerializedBudget[]>(() => ({
		queryKey: [
			'budgets',
			selectedMonth,
			selectedYear,
			Intl.DateTimeFormat().resolvedOptions().timeZone
		],
		queryFn: async () => {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			return (
				await fetch(`/api/budgets?month=${selectedMonth}&year=${selectedYear}&tz=${tz}`)
			).json();
		}
	}));

	let budgets = $derived(
		[...(budgetsQuery.data ?? [])].sort((a, b) => {
			const byCategory = a.category.localeCompare(b.category, undefined, {
				sensitivity: 'base'
			});
			if (byCategory !== 0) return byCategory;
			return a.id.localeCompare(b.id);
		})
	);

	let isSubmitting = $state(false);

	const periods = [
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'yearly', label: 'Yearly' }
	];

	const currenciesQuery = createQuery(() => ({
		queryKey: ['currencies'],
		queryFn: async () => {
			const res = await fetch('/api/currencies');
			return res.json();
		}
	}));

	let currencies = $derived(currenciesQuery.data ?? []);

	let selectedPeriod = $state('monthly');
	let currencyId = $state('');
	let createIcon = $state(DEFAULT_BUDGET_ICON);
	let createColor = $state(DEFAULT_BUDGET_COLOR);

	let editOpen = $state(false);
	let editBudgetId = $state('');
	let editCategory = $state('');
	let editIcon = $state(DEFAULT_BUDGET_ICON);
	let editColor = $state(DEFAULT_BUDGET_COLOR);
	let editLimitStr = $state('');
	let editPeriod = $state('monthly');
	let editStartDate = $state('');
	let editCurrencyLabel = $state('');
	let isUpdating = $state(false);

	$effect(() => {
		if (currencies.length > 0 && !currencyId) {
			currencyId = currencies[0].id;
		}
	});

	function openEdit(b: {
		id: string;
		category: string;
		limit: number;
		period: 'monthly' | 'weekly' | 'yearly';
		icon?: string | null;
		color?: string | null;
		startDate: string | Date;
		currencyCode?: string | null;
		currencySymbol?: string | null;
	}) {
		editBudgetId = b.id;
		editCategory = b.category;
		editIcon = b.icon ?? DEFAULT_BUDGET_ICON;
		editColor = b.color ?? DEFAULT_BUDGET_COLOR;
		editLimitStr = (b.limit / 100).toFixed(2);
		editPeriod = b.period;
		const sd = typeof b.startDate === 'string' ? new Date(b.startDate) : b.startDate;
		editStartDate = Number.isNaN(sd.getTime()) ? '' : sd.toISOString().slice(0, 10);
		editCurrencyLabel =
			b.currencyCode != null && b.currencyCode !== ''
				? `${b.currencyCode}${b.currencySymbol ? ` (${b.currencySymbol})` : ''}`
				: (b.currencySymbol ?? '—');
		editOpen = true;
	}
</script>

<svelte:head>
	<title>Budgets - {DASHBOARD_MONTHS[selectedMonth]} {selectedYear}</title>
</svelte:head>

<div>
	<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
		<div>
			<h1 class="text-2xl font-bold">Budgets</h1>
			<p class="text-sm text-muted-foreground">
				Set spending limits for your categories in {DASHBOARD_MONTHS[selectedMonth]}
				{selectedYear}
			</p>
		</div>
	</div>

	<div class="grid gap-8 lg:grid-cols-3">
		<!-- Create Budget Form -->
		<div>
			<Card.Root class="lg:col-span-1">
				<Card.Header>
					<Card.Title>Create New Budget</Card.Title>
					<Card.Description>Add a new spending limit</Card.Description>
				</Card.Header>
				<Card.Content>
					<form
						method="POST"
						action="?/create"
						use:enhance={() => {
							isSubmitting = true;
							return async ({ result }) => {
								isSubmitting = false;
								if (result.type === 'success') {
									queryClient.invalidateQueries({ queryKey: ['budgets'] });
								}
							};
						}}
						class="space-y-4"
					>
						<div class="space-y-2">
							<Label for="category">Category Name</Label>
							<Input id="category" name="category" placeholder="e.g. Groceries, Rent" required />
						</div>

						<BudgetVisualPicker bind:icon={createIcon} bind:color={createColor} idPrefix="create-budget" />

						<div class="space-y-2">
							<Label for="limit">Monthly Limit</Label>
							<div class="relative">
								<span class="absolute top-2.5 left-3 text-muted-foreground">$</span>
								<Input
									id="limit"
									name="limit"
									type="number"
									step="0.01"
									placeholder="0.00"
									class="pl-7"
									required
								/>
							</div>
						</div>

						<div class="space-y-2">
							<Label for="period">Period</Label>
							<Select.Root type="single" bind:value={selectedPeriod} name="period">
								<Select.Trigger>
									{periods.find((p) => p.value === selectedPeriod)?.label ?? 'Select period'}
								</Select.Trigger>
								<Select.Content>
									{#each periods as period (period.value)}
										<Select.Item value={period.value}>{period.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<div class="space-y-2">
							<Label for="currencyId">Currency</Label>
							<Select.Root type="single" bind:value={currencyId}>
								<Select.Trigger class="w-full">
									<div class="flex items-center gap-2">
										<Globe class="h-4 w-4 text-muted-foreground" />
										<span
											>{currencies.find((c: { id: string; code: string }) => c.id === currencyId)
												?.code ?? 'Select currency'}</span
										>
									</div>
								</Select.Trigger>
								<Select.Content>
									{#each currencies as currency (currency.id)}
										<Select.Item value={currency.id} label={currency.code}>
											{currency.code} - {currency.name}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<input type="hidden" name="currencyId" value={currencyId} />
						</div>

						<div class="space-y-2">
							<Label for="startDate">Start Date</Label>
							<Input
								id="startDate"
								name="startDate"
								type="date"
								required
								value={new Date().toISOString().split('T')[0]}
							/>
						</div>

						<Button type="submit" class="w-full" disabled={isSubmitting}>
							{#if isSubmitting}
								Creating...
							{:else}
								<Plus class="mr-2 h-4 w-4" />
								Create Budget
							{/if}
						</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Budget List -->
		<div class="space-y-4 lg:col-span-2">
			{#if budgetsQuery.isLoading}
				<div class="flex justify-center py-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
					></div>
				</div>
			{:else}
				{#each budgets as budget (budget.id)}
					{@const spent = budget.periodSpent}
					<Card.Root>
						<Card.Content>
							<div class="mb-4 flex items-start justify-between gap-4">
								<div class="flex items-center gap-3">
									<BudgetIcon icon={budget.icon} color={budget.color} />
									<div>
										<h3 class="text-lg font-semibold">
											<a
												href={`/budgets/${budget.id}?month=${selectedMonth}&year=${selectedYear}`}
												class="rounded-sm transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
											>
												{budget.category}
											</a>
										</h3>
										<p class="text-xs text-muted-foreground capitalize">{budget.period} limit</p>
									</div>
								</div>
								<div class="flex shrink-0 flex-col items-end gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() => openEdit(budget)}
									>
										<Pencil class="mr-1.5 h-3.5 w-3.5" />
										Edit
									</Button>
									<div class="text-right">
										<div class="text-sm font-medium">
											{budget.currencySymbol ?? '$'}{(spent / 100).toFixed(2)} /
											<span class="text-lg font-bold"
												>{budget.currencySymbol ?? '$'}{(budget.limit / 100).toFixed(2)}</span
											>
										</div>
									</div>
								</div>
							</div>

							<div class="space-y-2">
								<Progress
									value={budget.limit > 0 ? Math.min((spent / budget.limit) * 100, 100) : 0}
									class="h-3"
								/>
								<div class="flex justify-between text-xs text-muted-foreground">
									<span
										>{budget.limit > 0 ? Math.round((spent / budget.limit) * 100) : 0}% spent</span
									>
									{#if spent > budget.limit}
										<span class="font-medium text-rose-500"
											>Over budget by {budget.currencySymbol ?? '$'}{(
												(spent - budget.limit) /
												100
											).toFixed(2)}</span
										>
									{:else}
										<span
											>{budget.currencySymbol ?? '$'}{((budget.limit - spent) / 100).toFixed(2)} remaining</span
										>
									{/if}
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{:else}
					<Card.Root class="border-dashed">
						<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
							<PiggyBank class="h-12 w-12 text-muted-foreground mb-4" />
							<h3 class="text-lg font-semibold">No budgets found</h3>
							<p class="text-muted-foreground max-w-xs">
								Create your first budget to start tracking your spending by category.
							</p>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
		</div>
	</div>
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
						queryClient.invalidateQueries({ queryKey: ['budgets'] });
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
			<input type="hidden" name="budgetId" value={editBudgetId} />
			<div class="space-y-2">
				<Label>Currency</Label>
				<p class="text-sm text-muted-foreground">{editCurrencyLabel}</p>
			</div>
			<div class="space-y-2">
				<Label for="edit-category">Category</Label>
				<Input id="edit-category" name="category" bind:value={editCategory} required />
			</div>
			<BudgetVisualPicker bind:icon={editIcon} bind:color={editColor} idPrefix="edit-budget" />
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
						Saving…
					{:else}
						Save changes
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
