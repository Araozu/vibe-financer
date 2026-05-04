<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		CreditCard,
		TrendingUp,
		TrendingDown,
		Coins,
		Wallet,
		Landmark,
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Loader2,
		Pencil,
		Trash2,
		LayoutGrid,
		Search,
		X
	} from '@lucide/svelte';
	import { useQueryClient } from '@tanstack/svelte-query';
	import TransactionRow from '$lib/components/transaction/transaction-row.svelte';
	import EditTransactionDialog from '$lib/components/transaction/edit-transaction-dialog.svelte';
	import EditAccountDialog from '$lib/components/account/edit-account-dialog.svelte';
	import MtdBalanceChart from '$lib/components/dashboard/mtd-balance-chart.svelte';
	import type { AccountType } from '$lib/domain/account';
	import type { TransactionTimeframe } from '$lib/application/transaction/list-transactions';
	import { goto } from '$app/navigation';
	import {
		DASHBOARD_MONTHS,
		getDashboardPeriodContext
	} from '$lib/components/layout/dashboard-period.js';

	const queryClient = useQueryClient();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let editingTransaction = $state<any | null>(null);
	let editDialogOpen = $state(false);
	let deletingTransactionId = $state<string | null>(null);
	let isDeleting = $state(false);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function openEditDialog(tx: any) {
		editingTransaction = tx;
		editDialogOpen = true;
	}

	async function handleDeleteTransaction(transactionId: string) {
		if (
			!confirm(
				'Are you sure you want to delete this transaction? This will adjust the account balance accordingly.'
			)
		) {
			return;
		}

		deletingTransactionId = transactionId;

		try {
			const response = await fetch(`/api/transactions/${transactionId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? 'Failed to delete transaction');
			}

			await queryClient.invalidateQueries({ queryKey: ['accounts', account.id] });
		} catch (error) {
			console.error('Error deleting transaction:', error);
			alert(error instanceof Error ? error.message : 'Failed to delete transaction');
		} finally {
			deletingTransactionId = null;
		}
	}

	async function handleDeleteAccount() {
		if (
			!confirm(
				'Are you sure you want to disable this account? This account will be hidden from your active accounts.'
			)
		) {
			return;
		}

		isDeleting = true;
		try {
			const response = await fetch(`/api/accounts/${account.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? 'Failed to disable account');
			}

			await queryClient.invalidateQueries({ queryKey: ['accounts'] });
			goto('/accounts');
		} catch (error) {
			console.error('Error disabling account:', error);
			alert(error instanceof Error ? error.message : 'Failed to disable account');
		} finally {
			isDeleting = false;
		}
	}

	let { data } = $props();
	const account = $derived(data.account);

	let offset = $state(0);
	const limit = 50;

	// Transaction filter: 'all' | 'income' | 'expense'
	let txFilter = $state<'all' | 'income' | 'expense' | 'transfer'>('all');
	let searchQuery = $state('');
	let debouncedSearch = $state('');
	let selectedTimeframe = $state<TransactionTimeframe>('all');
	let selectedCategory = $state('');

	// Debounce searchQuery by 350 ms so the query fires only after the user stops typing.
	$effect(() => {
		const value = searchQuery;
		const timer = setTimeout(() => {
			debouncedSearch = value;
		}, 350);

		return () => clearTimeout(timer);
	});

	const timeframeOptions: { value: TransactionTimeframe; label: string }[] = [
		{ value: 'all', label: 'All time' },
		{ value: '7d', label: 'Last 7 days' },
		{ value: '30d', label: 'Last 30 days' },
		{ value: '90d', label: 'Last 90 days' },
		{ value: 'this-month', label: 'This month' },
		{ value: 'last-month', label: 'Last month' },
		{ value: 'this-year', label: 'This year' }
	];

	const categories = $derived(data.categories ?? []);
	const filtersKey = $derived(
		[txFilter, selectedTimeframe, selectedCategory, debouncedSearch].join('::')
	);
	const hasActiveFilters = $derived(
		searchQuery.trim().length > 0 ||
			selectedTimeframe !== 'all' ||
			selectedCategory !== '' ||
			txFilter !== 'all'
	);
	let previousFiltersKey = $state('');

	$effect(() => {
		if (previousFiltersKey !== '' && previousFiltersKey !== filtersKey) {
			offset = 0;
		}

		previousFiltersKey = filtersKey;
	});

	const transactionsQuery = createQuery(() => ({
		queryKey: [
			'accounts',
			account.id,
			'transactions',
			offset,
			txFilter,
			selectedTimeframe,
			selectedCategory,
			debouncedSearch
		],
		queryFn: async () => {
			const queryParams = [
				`limit=${encodeURIComponent(limit.toString())}`,
				`offset=${encodeURIComponent(offset.toString())}`,
				`type=${encodeURIComponent(txFilter)}`,
				`timeframe=${encodeURIComponent(selectedTimeframe)}`,
				...(debouncedSearch ? [`search=${encodeURIComponent(debouncedSearch)}`] : []),
				...(selectedCategory ? [`category=${encodeURIComponent(selectedCategory)}`] : [])
			].join('&');

			const res = await fetch(`/api/accounts/${account.id}/transactions?${queryParams}`);
			return res.json();
		},
		placeholderData: (previousData: unknown) => previousData
	}));

	let allTransactions = $derived(
		debouncedSearch.length === 0 &&
			selectedTimeframe === 'all' &&
			selectedCategory === '' &&
			txFilter === 'all' &&
			offset === 0
			? data.initialTransactions
			: (transactionsQuery.data?.transactions ?? [])
	);
	let hasMore = $derived(transactionsQuery.data?.hasMore ?? true);
	let transactions = $derived(allTransactions);

	// Chart data query
	const dashboardPeriod = getDashboardPeriodContext();
	let chartMonth = $derived(dashboardPeriod.month);
	let chartYear = $derived(dashboardPeriod.year);

	const chartQuery = createQuery(() => ({
		queryKey: ['chart-transactions', account.id, chartMonth, chartYear],
		queryFn: async () => {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const res = await fetch(`/api/transactions?month=${chartMonth}&year=${chartYear}&tz=${tz}`);
			return res.json();
		}
	}));

	let chartTransactions = $derived(chartQuery.data?.transactions ?? []);
	let chartInitialBalances = $derived(chartQuery.data?.initialBalances ?? {});

	// Compute monthly income/expenses from transaction data
	let monthlyIncome = $derived(
		allTransactions
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.filter((tx: any) => tx.type === 'income')
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.reduce((sum: number, tx: any) => sum + tx.amount, 0)
	);

	let monthlyExpenses = $derived(
		allTransactions
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.filter((tx: any) => tx.type === 'expense')
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.reduce((sum: number, tx: any) => sum + tx.amount, 0)
	);

	let monthlyNet = $derived(monthlyIncome - monthlyExpenses);
	let totalTransactionCount = $derived(allTransactions.length);

	const typeIcons: Record<AccountType, typeof CreditCard> = {
		asset: CreditCard,
		expense: TrendingDown,
		revenue: TrendingUp,
		liability: Coins,
		savings: Landmark
	};

	const typeLabels: Record<AccountType, string> = {
		asset: 'Checking Account',
		expense: 'Expense Account',
		revenue: 'Revenue Account',
		liability: 'Liability Account',
		savings: 'Savings Account'
	};

	function formatAmount(amount: number, currencySymbol: string = '$') {
		const formatted = (Math.abs(amount) / 100).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		return `${currencySymbol}${formatted}`;
	}

	function nextPage() {
		if (hasMore) offset += limit;
	}

	function prevPage() {
		if (offset >= limit) offset -= limit;
	}

	function clearFilters() {
		searchQuery = '';
		selectedTimeframe = 'all';
		selectedCategory = '';
		txFilter = 'all';
	}

	const Icon = $derived(typeIcons[account.type as AccountType] ?? Wallet);

	const skeuBtn =
		'rounded-md border border-border/40 bg-linear-to-b from-background to-accent/10 shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(0,0,0,0.1)] transition-all hover:to-accent/20 active:translate-y-px active:shadow-inner dark:from-muted/15 dark:to-muted/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_1.5px_3px_rgba(0,0,0,0.3)] dark:hover:to-muted/10';
</script>

<!-- Breadcrumb -->
<div class="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
	<a href="/accounts" class="flex items-center gap-1 transition-colors hover:text-foreground">
		<ArrowLeft class="h-3.5 w-3.5" />
		Accounts
	</a>
	<span class="text-muted-foreground/40">/</span>
	<span class="font-medium text-foreground">{account.name}</span>
</div>

<!-- Account Header -->
<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
	<div class="flex items-center gap-4">
		<div
			class="flex h-14 w-14 items-center justify-center rounded-2xl shadow-md"
			style="background-color: {account.color}15; color: {account.color}"
		>
			<Icon class="h-7 w-7" />
		</div>
		<div>
			<h1 class="text-2xl font-bold">{account.name}</h1>
			<div class="flex items-center gap-2 text-sm">
				<span class="font-medium text-primary"
					>{typeLabels[account.type as AccountType] ?? 'Account'}</span
				>
				<span class="text-muted-foreground">{account.currencyCode ?? 'USD'}</span>
			</div>
		</div>
	</div>
	<div class="flex items-center gap-4">
		<div class="text-right">
			<p class="text-xs text-muted-foreground">Current Balance</p>
			<p class="text-3xl font-bold tracking-tight">
				{formatAmount(account.currentBalance, account.currencySymbol ?? '$')}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<EditAccountDialog {account}>
				{#snippet trigger()}
					<button class="{skeuBtn} flex h-9 items-center gap-2 px-3 text-sm font-medium">
						<Pencil class="h-3.5 w-3.5" />
						Edit
					</button>
				{/snippet}
			</EditAccountDialog>
			<button
				class="{skeuBtn} flex h-9 items-center gap-2 px-3 text-sm font-medium text-destructive"
				onclick={handleDeleteAccount}
				disabled={isDeleting}
			>
				<Trash2 class="h-3.5 w-3.5" />
				{isDeleting ? 'Disabling...' : 'Disable'}
			</button>
		</div>
	</div>
</div>

<!-- Summary Cards -->
<div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
	<!-- Income this month -->
	<Card.Root class="{skeuBtn} border-border/30">
		<Card.Content class="p-4">
			<div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
				<TrendingUp class="h-3.5 w-3.5 text-emerald-500" />
				Income this month
			</div>
			<p class="text-xl font-bold">
				{formatAmount(monthlyIncome, account.currencySymbol ?? '$')}
			</p>
		</Card.Content>
	</Card.Root>

	<!-- Expenses this month -->
	<Card.Root class="{skeuBtn} border-border/30">
		<Card.Content class="p-4">
			<div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
				<TrendingDown class="h-3.5 w-3.5 text-destructive" />
				Expenses this month
			</div>
			<p class="text-xl font-bold">
				{formatAmount(monthlyExpenses, account.currencySymbol ?? '$')}
			</p>
		</Card.Content>
	</Card.Root>

	<!-- Net this month -->
	<Card.Root class="{skeuBtn} border-border/30">
		<Card.Content class="p-4">
			<div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
				<TrendingUp
					class="h-3.5 w-3.5 {monthlyNet >= 0 ? 'text-emerald-500' : 'text-destructive'}"
				/>
				Net this month
			</div>
			<p class="text-xl font-bold {monthlyNet >= 0 ? '' : 'text-destructive'}">
				{monthlyNet >= 0 ? '' : '-'}{formatAmount(
					Math.abs(monthlyNet),
					account.currencySymbol ?? '$'
				)}
			</p>
		</Card.Content>
	</Card.Root>

	<!-- Transaction count -->
	<Card.Root class="{skeuBtn} border-border/30">
		<Card.Content class="p-4">
			<div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
				<LayoutGrid class="h-3.5 w-3.5 text-primary" />
				Transactions
			</div>
			<p class="text-xl font-bold">
				{totalTransactionCount}
			</p>
		</Card.Content>
	</Card.Root>
</div>

<!-- Balance History Chart -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between gap-3">
		<div>
			<h2 class="text-lg font-bold tracking-tight">Balance History</h2>
			<p class="text-sm text-muted-foreground">
				{DASHBOARD_MONTHS[chartMonth]}
				{chartYear}
			</p>
		</div>
	</div>

	<MtdBalanceChart
		accounts={[account]}
		transactions={chartTransactions}
		initialBalances={chartInitialBalances}
		selectedMonth={chartMonth}
		selectedYear={chartYear}
	/>
</div>

<!-- Transactions Section -->
<Card.Root class="shadow-sm">
	<Card.Header class="flex flex-row items-center justify-between border-b border-border/40 pb-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-bold">Transactions</h2>
			<Badge variant="secondary" class="rounded-full px-2.5 py-0.5 text-xs font-semibold">
				{totalTransactionCount}
			</Badge>
		</div>
		<div class="flex items-center gap-2">
			{#if hasActiveFilters}
				<Button variant="ghost" size="sm" class="h-9 gap-1.5 px-2.5 text-xs" onclick={clearFilters}>
					<X class="h-3.5 w-3.5" />
					Clear
				</Button>
			{/if}
		</div>
	</Card.Header>
	<Card.Content class="space-y-4 p-6 pb-0">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="relative w-full lg:max-w-sm">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					placeholder="Search transactions"
					class="pl-9"
					bind:value={searchQuery}
				/>
			</div>

			<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
				<Select.Root type="single" bind:value={selectedTimeframe}>
					<Select.Trigger class="w-full sm:w-[170px]">
						{timeframeOptions.find((option) => option.value === selectedTimeframe)?.label ??
							'All time'}
					</Select.Trigger>
					<Select.Content>
						{#each timeframeOptions as option (option.value)}
							<Select.Item value={option.value} label={option.label}>
								{option.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				<Select.Root type="single" bind:value={selectedCategory}>
					<Select.Trigger class="w-full sm:w-[170px]">
						{selectedCategory || 'All categories'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="" label="All categories">All categories</Select.Item>
						{#each categories as category (category)}
							<Select.Item value={category} label={category}>
								{category}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<div
			class="flex flex-wrap items-center gap-1 overflow-hidden rounded-lg border border-border/40 bg-muted/30"
		>
			{#each ['all', 'income', 'expense', 'transfer'] as filter (filter)}
				<button
					class="px-3 py-1.5 text-xs font-medium capitalize transition-all
						{txFilter === filter
						? 'bg-foreground text-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => {
						txFilter = filter as typeof txFilter;
					}}
				>
					{filter === 'all' ? 'All' : filter}
				</button>
			{/each}
		</div>

		{#if transactionsQuery.isPending && transactions.length === 0}
			<div class="flex h-64 items-center justify-center">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground/40" />
			</div>
		{:else}
			<Table.Root>
				<Table.Header class="bg-muted/30">
					<Table.Row class="hover:bg-transparent">
						<Table.Head class="h-10 pl-6 text-[10px] font-bold tracking-widest uppercase"
							>Transaction</Table.Head
						>
						<Table.Head
							class="hidden h-10 text-[10px] font-bold tracking-widest uppercase md:table-cell"
							>Account</Table.Head
						>
						<Table.Head
							class="hidden h-10 text-[10px] font-bold tracking-widest uppercase md:table-cell"
							>Category</Table.Head
						>
						<Table.Head class="h-10 pr-6 text-right text-[10px] font-bold tracking-widest uppercase"
							>Amount</Table.Head
						>
						<Table.Head class="h-10 w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if transactions.length === 0}
						<Table.Row>
							<Table.Cell colspan={5} class="py-24 text-center text-muted-foreground">
								{hasActiveFilters
									? 'No transactions match the current filters.'
									: 'No transactions found.'}
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each transactions as tx (tx.id)}
							<TransactionRow
								tx={{
									...tx,
									createdAt:
										tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
									updatedAt:
										tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : tx.updatedAt,
									deletedAt:
										tx.deletedAt instanceof Date
											? tx.deletedAt.toISOString()
											: (tx.deletedAt ?? null)
								}}
								{account}
								{deletingTransactionId}
								onEdit={openEditDialog}
								onDelete={handleDeleteTransaction}
							/>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		{/if}
	</Card.Content>

	<!-- Pagination -->
	{#if allTransactions.length > 0}
		<div class="flex items-center justify-between border-t border-border/40 px-6 py-3">
			<p class="text-xs text-muted-foreground">
				Showing {offset + 1}–{offset + allTransactions.length} transactions
			</p>
			<div class="flex items-center gap-2">
				<button
					class="{skeuBtn} flex h-8 w-8 items-center justify-center disabled:opacity-40"
					onclick={prevPage}
					disabled={offset === 0 || transactionsQuery.isPending}
				>
					<ChevronLeft class="h-4 w-4" />
				</button>
				<span class="text-xs font-medium text-muted-foreground">
					Page {offset / limit + 1}
				</span>
				<button
					class="{skeuBtn} flex h-8 w-8 items-center justify-center disabled:opacity-40"
					onclick={nextPage}
					disabled={!hasMore || transactionsQuery.isPending}
				>
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/if}
</Card.Root>

<!-- Edit Transaction Dialog -->
{#if editingTransaction}
	<EditTransactionDialog
		transaction={{
			...editingTransaction,
			createdAt: new Date(editingTransaction.createdAt),
			updatedAt: new Date(editingTransaction.updatedAt),
			deletedAt: null
		}}
		_accounts={[account]}
		bind:open={editDialogOpen}
	/>
{/if}
