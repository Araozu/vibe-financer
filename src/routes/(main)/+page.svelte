<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { SvelteDate, SvelteSet } from 'svelte/reactivity';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { toast } from 'svelte-sonner';
	import { format } from 'date-fns';
	import CreateAccountDialog from '$lib/components/account/create-account-dialog.svelte';
	import CreateTransactionForm from '$lib/components/transaction/create-transaction-form.svelte';
	import EditTransactionDialog from '$lib/components/transaction/edit-transaction-dialog.svelte';
	import SetGoalDialog from '$lib/components/account/set-goal-dialog.svelte';
	import MtdBalanceChart from '$lib/components/dashboard/mtd-balance-chart.svelte';
	import TodoListCard from '$lib/components/dashboard/todo-list-card.svelte';
	import TransactionRow from '$lib/components/transaction/transaction-row.svelte';
	import BudgetIcon from '$lib/components/budget/budget-icon.svelte';
	import {
		Wallet,
		TrendingUp,
		TrendingDown,
		PiggyBank,
		Plus,
		Target,
		CalendarClock,
		ChevronDown,
		Pencil,
		Search,
		Trash2
	} from '@lucide/svelte';
	import type { Account } from '$lib/domain/account';
	import { calculateAccountBalanceDelta, type Transaction } from '$lib/domain/transaction';
	import { DEFAULT_CURRENCY_SYMBOL, formatMoney } from '$lib/domain/currency';
	import { getBudgetStatus, type BudgetStatus } from '$lib/domain/spending-analytics';
	import { formatLocalDate } from '$lib/domain/date-formatter';
	import {
		DASHBOARD_MONTHS,
		getDashboardPeriodContext
	} from '$lib/components/layout/dashboard-period.js';

	type SerializedGoal = {
		id: string;
		accountId: string;
		targetAmount: number;
		targetDate: string | null;
		name: string;
		createdAt: string;
		updatedAt: string;
	};

	type SerializedAccount = Omit<Account, 'createdAt' | 'updatedAt'> & {
		createdAt: string;
		updatedAt: string;
		goal: SerializedGoal | null;
	};

	type SerializedTransaction = Omit<Transaction, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
		createdAt: string;
		updatedAt: string;
		deletedAt: string | null;
	};

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

	const RECENT_TX_FILTER_ALL = 'all';
	const RECENT_TX_FILTER_UNCATEGORIZED = '__uncategorized__';

	const BUDGET_PROGRESS_CLASS: Record<BudgetStatus, string> = {
		'on-track': 'bg-income/15 *:data-[slot=progress-indicator]:bg-income',
		'near-limit': 'bg-warning/20 *:data-[slot=progress-indicator]:bg-warning',
		over: 'bg-expense/15 *:data-[slot=progress-indicator]:bg-expense'
	};

	const BUDGET_STATUS_TEXT_CLASS: Record<BudgetStatus, string> = {
		'on-track': 'text-muted-foreground',
		'near-limit': 'font-medium text-foreground',
		over: 'font-medium text-expense'
	};

	function transactionMatchesTableFilters(
		tx: SerializedTransaction,
		queryLower: string,
		categoryFilter: string
	): boolean {
		if (categoryFilter !== RECENT_TX_FILTER_ALL) {
			if (categoryFilter === RECENT_TX_FILTER_UNCATEGORIZED) {
				if (tx.category?.trim()) return false;
			} else if (tx.category !== categoryFilter) {
				return false;
			}
		}
		if (!queryLower) return true;
		const blob = [tx.name, tx.description, tx.payee, tx.category]
			.map((s) => (s ?? '').toLowerCase())
			.join('\n');
		return blob.includes(queryLower);
	}

	type TransactionDayGroup = {
		date: string;
		transactions: SerializedTransaction[];
		totals: TransactionDayTotal[];
	};

	type TransactionDayTotal = {
		amount: number;
		currencyId: string;
		currencyCode: string;
		currencySymbol: string;
	};

	function groupTransactionsByDay(
		transactions: SerializedTransaction[],
		totalTransactions: SerializedTransaction[],
		accounts: SerializedAccount[],
		fallbackCurrencyId: string,
		fallbackCurrencySymbol: string
	): TransactionDayGroup[] {
		const groups: TransactionDayGroup[] = [];

		for (const tx of transactions) {
			const date = formatLocalDate(tx.createdAt);
			const existingGroup = groups.find((group) => group.date === date);
			const group = existingGroup ?? { date, transactions: [], totals: [] };

			group.transactions.push(tx);
			if (existingGroup == null) groups.push(group);
		}

		for (const tx of totalTransactions) {
			if (tx.type !== 'expense') continue;

			const group = groups.find((candidate) => candidate.date === formatLocalDate(tx.createdAt));
			if (group == null) continue;

			const account = accounts.find((candidate) => candidate.id === tx.accountId);
			const currencyId = account?.currencyId ?? fallbackCurrencyId;
			const currencyCode = account?.currencyCode ?? currencyId;
			const currencySymbol = account?.currencySymbol ?? fallbackCurrencySymbol;
			const existingTotal = group.totals.find((total) => total.currencyId === currencyId);

			if (existingTotal) {
				existingTotal.amount += tx.amount;
			} else {
				group.totals.push({ amount: tx.amount, currencyId, currencyCode, currencySymbol });
			}
		}

		return groups;
	}

	const dashboardPeriod = getDashboardPeriodContext();
	let dashboardNow = $state(new Date());
	let selectedMonth = $derived(dashboardPeriod.month);
	let selectedYear = $derived(dashboardPeriod.year);

	$effect(() => {
		const interval = setInterval(() => {
			dashboardNow = new Date();
		}, 60_000);
		return () => clearInterval(interval);
	});

	// Query for accounts
	const accountsQuery = createQuery<SerializedAccount[]>(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json()
	}));

	// Query for transactions
	const transactionsQuery = createQuery<{
		transactions: SerializedTransaction[];
		initialBalances: Record<string, number>;
	}>(() => ({
		queryKey: [
			'transactions',
			selectedMonth,
			selectedYear,
			Intl.DateTimeFormat().resolvedOptions().timeZone
		],
		queryFn: async () => {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const res = await fetch(
				`/api/transactions?month=${selectedMonth}&year=${selectedYear}&tz=${tz}`
			);
			return res.json();
		}
	}));

	// Query for budgets
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

	// Query for user (to get defaultAccountId)
	const userQuery = createQuery<{ defaultAccountId: string | null }>(() => ({
		queryKey: ['user'],
		queryFn: async () => (await fetch('/api/user')).json()
	}));

	const queryClient = useQueryClient();

	let accounts = $derived(accountsQuery.data ?? []);
	let isLoadingAccounts = $derived(accountsQuery.isPending && accounts.length === 0);
	let transactions = $derived(transactionsQuery.data?.transactions ?? []);
	let initialBalances = $derived(transactionsQuery.data?.initialBalances ?? {});
	let budgets = $derived(
		[...(budgetsQuery.data ?? [])].sort((a, b) => {
			if (a.limit !== b.limit) return b.limit - a.limit;
			const byCat = a.category.localeCompare(b.category, undefined, { sensitivity: 'base' });
			if (byCat !== 0) return byCat;
			return a.id.localeCompare(b.id);
		})
	);
	let defaultAccountId = $derived(userQuery.data?.defaultAccountId ?? null);
	let defaultAccount = $derived(accounts.find((a) => a.id === defaultAccountId) ?? null);

	let editingTransaction = $state<SerializedTransaction | null>(null);
	let editDialogOpen = $state(false);
	let deletingTransactionId = $state<string | null>(null);
	let pendingDeleteTransaction = $state<SerializedTransaction | null>(null);
	let deleteDialogOpen = $state(false);
	let upcomingTransactionsOpen = $state(false);
	let recentTxSearch = $state('');
	let recentCategoryFilter = $state(RECENT_TX_FILTER_ALL);

	let goalDialogOpen = $state(false);
	let goalAccount = $state<SerializedAccount | null>(null);

	function openGoalDialog(account: SerializedAccount) {
		goalAccount = account;
		goalDialogOpen = true;
	}

	function openEditDialog(tx: SerializedTransaction) {
		editingTransaction = tx;
		editDialogOpen = true;
	}

	function requestDeleteTransaction(transactionId: string) {
		pendingDeleteTransaction = transactions.find((tx) => tx.id === transactionId) ?? null;
		deleteDialogOpen = pendingDeleteTransaction !== null;
	}

	async function confirmDeleteTransaction() {
		const tx = pendingDeleteTransaction;
		deleteDialogOpen = false;
		if (tx) await handleDeleteTransaction(tx.id);
	}

	async function handleDeleteTransaction(transactionId: string) {
		deletingTransactionId = transactionId;

		try {
			const response = await fetch(`/api/transactions/${transactionId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? 'Failed to delete transaction');
			}

			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['transactions'] }),
				queryClient.invalidateQueries({ queryKey: ['chart-transactions'] }),
				queryClient.invalidateQueries({ queryKey: ['accounts'] }),
				queryClient.invalidateQueries({ queryKey: ['budgets'] })
			]);
			toast.success('Transaction deleted');
		} catch (error) {
			console.error('Error deleting transaction:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to delete transaction');
		} finally {
			deletingTransactionId = null;
		}
	}

	// Calculate real stats (filtered for selected month and capped at today)
	let firstDayOfSelectedMonth = $derived(new Date(selectedYear, selectedMonth, 1));
	let lastDayOfSelectedMonth = $derived(
		new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
	);

	let isCurrentMonth = $derived(
		selectedMonth === dashboardNow.getMonth() && selectedYear === dashboardNow.getFullYear()
	);

	let effectiveEndDate = $derived(isCurrentMonth ? dashboardNow : lastDayOfSelectedMonth);

	let defaultCurrencySymbol = $derived(defaultAccount?.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL);
	let tomorrowStart = $derived.by(() => {
		const tomorrow = new SvelteDate(dashboardNow);
		tomorrow.setHours(24, 0, 0, 0);
		return tomorrow;
	});

	let postedTransactions = $derived(
		transactions.filter((tx) => new Date(tx.createdAt) < tomorrowStart)
	);

	let futureTransactions = $derived(
		transactions.filter((tx) => new Date(tx.createdAt) >= tomorrowStart)
	);

	let recentCategorySelectOptions = $derived.by(() => {
		const seen = new SvelteSet<string>();
		for (const tx of postedTransactions) {
			const c = tx.category?.trim();
			if (c) seen.add(c);
		}
		for (const tx of futureTransactions) {
			const c = tx.category?.trim();
			if (c) seen.add(c);
		}
		return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	});

	let filterHasUncategorized = $derived(
		postedTransactions.some((tx) => !tx.category?.trim()) ||
			futureTransactions.some((tx) => !tx.category?.trim())
	);

	let filteredRecentTransactions = $derived.by(() => {
		const q = recentTxSearch.trim().toLowerCase();
		const cat = recentCategoryFilter;
		const filtered = postedTransactions.filter((tx) => transactionMatchesTableFilters(tx, q, cat));
		return [...filtered].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	});

	let filtersActive = $derived(
		recentTxSearch.trim() !== '' || recentCategoryFilter !== RECENT_TX_FILTER_ALL
	);

	function clearTransactionFilters() {
		recentTxSearch = '';
		recentCategoryFilter = RECENT_TX_FILTER_ALL;
	}

	let recentTransactions = $derived(
		filtersActive
			? filteredRecentTransactions.slice(0, 500)
			: filteredRecentTransactions.slice(0, 10)
	);

	let filteredUpcomingTransactions = $derived.by(() => {
		const q = recentTxSearch.trim().toLowerCase();
		const cat = recentCategoryFilter;
		const filtered = futureTransactions.filter((tx) => transactionMatchesTableFilters(tx, q, cat));
		return [...filtered].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	});

	let upcomingTransactions = $derived(
		filtersActive
			? filteredUpcomingTransactions.slice(0, 500)
			: filteredUpcomingTransactions.slice(0, 10)
	);

	let recentTransactionsSummary = $derived.by(() => {
		const monthName = DASHBOARD_MONTHS[selectedMonth];
		const total = filteredRecentTransactions.length;
		if (filtersActive) return `${total} ${total === 1 ? 'match' : 'matches'} in ${monthName}`;
		if (total === 0) return `Nothing recorded in ${monthName} yet`;
		if (recentTransactions.length < total) {
			return `Latest ${recentTransactions.length} of ${total} in ${monthName}`;
		}
		return `${total} ${total === 1 ? 'transaction' : 'transactions'} in ${monthName}`;
	});

	let recentTransactionGroups = $derived(
		groupTransactionsByDay(
			recentTransactions,
			filteredRecentTransactions,
			accounts,
			defaultAccount?.currencyId ?? 'default',
			defaultCurrencySymbol
		)
	);
	let upcomingTransactionGroups = $derived(
		groupTransactionsByDay(
			upcomingTransactions,
			filteredUpcomingTransactions,
			accounts,
			defaultAccount?.currencyId ?? 'default',
			defaultCurrencySymbol
		)
	);

	function formatDayTotal(totals: TransactionDayTotal[]): string {
		if (totals.length === 0) return formatMoney(0, defaultCurrencySymbol);
		const hasDuplicateSymbol = totals.some(
			(total, index) =>
				totals.findIndex((candidate) => candidate.currencySymbol === total.currencySymbol) !== index
		);

		return totals
			.map(
				({ amount, currencyCode, currencySymbol }) =>
					`${formatMoney(-amount, currencySymbol)}${hasDuplicateSymbol ? ` ${currencyCode}` : ''}`
			)
			.join(' · ');
	}

	let defaultAccountTransactions = $derived(
		defaultAccount
			? transactions.filter(
					(tx) => tx.accountId === defaultAccount.id || tx.toAccountId === defaultAccount.id
				)
			: []
	);

	function getMidMonthOpeningBalance(
		account: { createdAt: string | Date; initialBalance: number },
		endDate: Date
	): number {
		const createdAt = new Date(account.createdAt);
		return createdAt > firstDayOfSelectedMonth && createdAt <= endDate ? account.initialBalance : 0;
	}

	let totalBalance = $derived.by(() => {
		if (!defaultAccount) return 0;
		const initialBalance =
			(initialBalances[defaultAccount.id] ?? 0) +
			getMidMonthOpeningBalance(defaultAccount, effectiveEndDate);
		return (
			initialBalance +
			defaultAccountTransactions
				.filter((tx) => new Date(tx.createdAt) <= effectiveEndDate)
				.reduce((acc: number, tx) => acc + calculateAccountBalanceDelta(tx, defaultAccount.id), 0)
		);
	});

	let formattedTotalBalance = $derived(formatMoney(totalBalance, defaultCurrencySymbol));

	// Projected balance at the end of the selected month (includes future-dated transactions
	// within the selected month, e.g. scheduled bills or upcoming income).
	let projectedEndOfMonthBalance = $derived.by(() => {
		if (!defaultAccount) return 0;
		const initialBalance =
			(initialBalances[defaultAccount.id] ?? 0) +
			getMidMonthOpeningBalance(defaultAccount, lastDayOfSelectedMonth);
		return (
			initialBalance +
			defaultAccountTransactions
				.filter((tx) => new Date(tx.createdAt) <= lastDayOfSelectedMonth)
				.reduce((acc: number, tx) => acc + calculateAccountBalanceDelta(tx, defaultAccount.id), 0)
		);
	});

	let formattedProjectedEndOfMonthBalance = $derived(
		formatMoney(projectedEndOfMonthBalance, defaultCurrencySymbol)
	);

	let monthlyIncome = $derived(
		defaultAccountTransactions
			.filter(
				(tx) =>
					tx.type === 'income' &&
					new Date(tx.createdAt) >= firstDayOfSelectedMonth &&
					new Date(tx.createdAt) <= effectiveEndDate
			)
			.reduce((acc: number, curr) => acc + curr.amount, 0)
	);

	let monthlyExpenses = $derived(
		defaultAccountTransactions
			.filter(
				(tx) =>
					tx.type === 'expense' &&
					new Date(tx.createdAt) >= firstDayOfSelectedMonth &&
					new Date(tx.createdAt) <= effectiveEndDate
			)
			.reduce((acc: number, curr) => acc + curr.amount, 0)
	);

	let formattedMonthlyIncome = $derived(formatMoney(monthlyIncome, defaultCurrencySymbol));
	let formattedMonthlyExpenses = $derived(formatMoney(monthlyExpenses, defaultCurrencySymbol));

	let savingsRate = $derived(
		monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0
	);

	// Find the first account with a goal to show in the dashboard
	let accountWithGoal = $derived(accounts.find((a) => a.goal !== null));
	let goal = $derived(accountWithGoal?.goal);

	let currentBalanceForGoalAccount = $derived.by(() => {
		if (!accountWithGoal) return 0;

		const initialBalance =
			(initialBalances[accountWithGoal.id] ?? 0) +
			getMidMonthOpeningBalance(accountWithGoal, effectiveEndDate);
		const netChange = transactions
			.filter(
				(tx) =>
					(tx.accountId === accountWithGoal.id || tx.toAccountId === accountWithGoal.id) &&
					new Date(tx.createdAt) <= effectiveEndDate
			)
			.reduce((acc, tx) => acc + calculateAccountBalanceDelta(tx, accountWithGoal.id), 0);

		return initialBalance + netChange;
	});

	let goalProgress = $derived(
		goal && accountWithGoal
			? Math.max(Math.min((currentBalanceForGoalAccount / goal.targetAmount) * 100, 100), 0)
			: 0
	);
	let goalRemaining = $derived(
		goal ? Math.max(goal.targetAmount - currentBalanceForGoalAccount, 0) : 0
	);
	let savingsAccounts = $derived(accounts.filter((a) => a.type === 'savings'));

	let budgetStatusSummary = $derived.by(() => {
		if (budgets.length === 0) return 'Track spending by category';
		const statuses = budgets.map((b) => getBudgetStatus(b.periodSpent, b.limit));
		const over = statuses.filter((status) => status === 'over').length;
		const near = statuses.filter((status) => status === 'near-limit').length;
		const parts = [];
		if (over > 0) parts.push(`${over} over limit`);
		if (near > 0) parts.push(`${near} close to limit`);
		return parts.length > 0 ? parts.join(' · ') : 'All budgets on track';
	});

	let periodLabel = $derived(
		isCurrentMonth
			? `${DASHBOARD_MONTHS[selectedMonth].slice(0, 3)} 1 – today`
			: `All of ${DASHBOARD_MONTHS[selectedMonth]}`
	);

	const summaryStats = $derived([
		{
			title: 'Current Balance',
			amount: formattedTotalBalance,
			subtitle: defaultAccount?.name ?? '',
			icon: Wallet,
			color: 'text-investment',
			class: 'md:col-span-2 lg:col-span-1'
		},
		{
			title: 'Projected Balance',
			amount: formattedProjectedEndOfMonthBalance,
			subtitle: `End of ${DASHBOARD_MONTHS[selectedMonth]} · incl. upcoming`,
			icon: CalendarClock,
			color: 'text-savings'
		},
		{
			title: 'Income',
			amount: formattedMonthlyIncome,
			subtitle: periodLabel,
			icon: TrendingUp,
			color: 'text-income'
		},
		{
			title: 'Expenses',
			amount: formattedMonthlyExpenses,
			subtitle: periodLabel,
			icon: TrendingDown,
			color: 'text-expense'
		},
		{
			title: 'Savings Rate',
			amount: `${savingsRate.toFixed(1)}%`,
			subtitle: monthlyIncome > 0 ? 'Of income kept this month' : 'No income yet',
			icon: PiggyBank,
			color: 'text-savings',
			amountClass: savingsRate < 0 ? 'text-expense' : ''
		}
	]);
</script>

<svelte:head>
	<title>Dashboard - {DASHBOARD_MONTHS[selectedMonth]} {selectedYear}</title>
</svelte:head>

{#snippet transactionGroups(groups: TransactionDayGroup[], isFuture: boolean)}
	{#each groups as group (group.date)}
		<Table.Body>
			<Table.Row class="border-b-0 hover:bg-transparent">
				<Table.Head
					colspan={3}
					scope="rowgroup"
					class="h-auto border-b-0 pt-4 pb-1.5 text-xs font-medium text-foreground/80"
				>
					<span class="flex items-center gap-2">
						{group.date}
						{#if isFuture}
							<Badge variant="outline" class="font-normal text-muted-foreground">Upcoming</Badge>
						{/if}
					</span>
				</Table.Head>
				<Table.Head
					class="h-auto border-b-0 pt-4 pb-1.5 text-right text-xs font-normal text-muted-foreground tabular-nums"
				>
					<span class="sr-only">Total spent </span>
					{formatDayTotal(group.totals)}
				</Table.Head>
				<Table.Head class="h-auto border-b-0 pt-4 pb-1.5" aria-hidden="true" />
			</Table.Row>
			{#each group.transactions as tx, i (tx.id)}
				<TransactionRow
					{tx}
					account={accounts.find((a) => a.id === tx.accountId) ?? null}
					{deletingTransactionId}
					{isFuture}
					showSeparator={i === group.transactions.length - 1}
					onEdit={openEditDialog}
					onDelete={requestDeleteTransaction}
				/>
			{/each}
		</Table.Body>
	{/each}
{/snippet}

<div class="flex flex-col gap-6">
	{#if defaultAccount}
		<!-- Mobile-only compact summary: keeps focus on the create transaction card -->
		<Card.Root class="flex-row items-center justify-between gap-4 px-4 py-3 md:hidden">
			<div class="flex items-center gap-2.5">
				<Wallet class="size-4 text-investment" />
				<div class="flex flex-col">
					<span class="text-xs text-muted-foreground">Now</span>
					<span class="leading-tight font-semibold tracking-tight tabular-nums">
						{formattedTotalBalance}
					</span>
				</div>
			</div>
			<div class="h-8 w-px bg-border"></div>
			<div class="flex items-center gap-2.5">
				<CalendarClock class="size-4 text-savings" />
				<div class="flex flex-col">
					<span class="text-xs text-muted-foreground">End of month</span>
					<span class="leading-tight font-semibold tracking-tight tabular-nums">
						{formattedProjectedEndOfMonthBalance}
					</span>
				</div>
			</div>
		</Card.Root>

		<div class="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-5">
			{#each summaryStats as stat (stat.title)}
				<Card.Root class="gap-3 {stat.class ?? ''}">
					<Card.Header class="flex flex-row items-center justify-between gap-2">
						<Card.Description class="truncate font-medium">{stat.title}</Card.Description>
						<div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
							<stat.icon class="size-4 {stat.color}" />
						</div>
					</Card.Header>
					<Card.Content class="space-y-1">
						<div
							class="text-2xl font-semibold tracking-tight tabular-nums {stat.amountClass ?? ''}"
						>
							{stat.amount}
						</div>
						<p class="truncate text-xs text-muted-foreground">{stat.subtitle}</p>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else if !isLoadingAccounts}
		<Card.Root class="border-dashed bg-muted/30 py-4">
			<Card.Content class="flex items-center justify-center gap-3 text-center">
				<Wallet class="size-5 shrink-0 text-muted-foreground" />
				<p class="text-sm text-muted-foreground">
					Set a <a href="/settings" class="font-medium text-primary underline underline-offset-4"
						>default account</a
					> in settings to see your summary stats here.
				</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<div class="grid grid-cols-1 gap-6 md:grid-cols-7">
		<div class="min-w-0 md:col-span-4">
			{#if isLoadingAccounts}
				<Card.Root class="border-dashed bg-muted/30">
					<Card.Content class="space-y-5 py-4">
						<div class="flex items-center gap-3">
							<Skeleton class="size-10 rounded-full" />
							<div class="space-y-2">
								<Skeleton class="h-4 w-36" />
								<Skeleton class="h-3 w-52 max-w-[60vw]" />
							</div>
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<Skeleton class="h-10 w-full" />
							<Skeleton class="h-10 w-full" />
						</div>
						<Skeleton class="h-24 w-full" />
						<Skeleton class="h-10 w-full" />
					</Card.Content>
				</Card.Root>
			{:else if accounts.length > 0}
				<Card.Root class="overflow-hidden py-0">
					<CreateTransactionForm {accounts} showCreateMore={false} />
				</Card.Root>
			{:else}
				<Card.Root class="border-dashed bg-muted/30">
					<Card.Content
						class="flex flex-col items-center justify-center space-y-4 py-4 text-center"
					>
						<div class="rounded-full bg-background p-3 shadow-sm">
							<Wallet class="size-6 text-muted-foreground" />
						</div>
						<div class="max-w-[250px] space-y-1">
							<h3 class="font-semibold">No accounts yet</h3>
							<p class="text-sm text-muted-foreground">
								Create an account to start recording transactions.
							</p>
						</div>
						<CreateAccountDialog />
					</Card.Content>
				</Card.Root>
			{/if}
		</div>

		<div class="min-w-0 md:col-span-3">
			<TodoListCard />
		</div>
	</div>

	<MtdBalanceChart {accounts} {transactions} {initialBalances} {selectedMonth} {selectedYear} />

	<div class="grid grid-cols-1 gap-6 md:grid-cols-7">
		<div class="min-w-0 md:col-span-4">
			<Card.Root>
				<Collapsible.Root bind:open={upcomingTransactionsOpen} class="flex flex-col gap-6">
					<Card.Header>
						<Card.Title>Recent Transactions</Card.Title>
						<Card.Description>{recentTransactionsSummary}</Card.Description>
						{#if futureTransactions.length > 0}
							<Card.Action>
								<Collapsible.Trigger
									class={buttonVariants({ variant: 'outline', size: 'sm' })}
									aria-label="Upcoming transactions ({upcomingTransactions.length})"
								>
									<CalendarClock />
									<span class="hidden sm:inline">Upcoming</span>
									<Badge variant="secondary" class="h-5 min-w-5 px-1.5 tabular-nums">
										{upcomingTransactions.length}
									</Badge>
									<ChevronDown
										class="transition-transform {upcomingTransactionsOpen ? 'rotate-180' : ''}"
									/>
								</Collapsible.Trigger>
							</Card.Action>
						{/if}
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
							<InputGroup.Root class="min-w-0 flex-1">
								<InputGroup.Addon>
									<Search />
								</InputGroup.Addon>
								<InputGroup.Input
									type="search"
									placeholder="Search name, payee, description…"
									aria-label="Search transactions"
									bind:value={recentTxSearch}
									autocomplete="off"
								/>
							</InputGroup.Root>
							<Select.Root type="single" bind:value={recentCategoryFilter}>
								<Select.Trigger class="w-full sm:w-48 sm:shrink-0" aria-label="Filter by category">
									<span class="truncate">
										{#if recentCategoryFilter === RECENT_TX_FILTER_ALL}
											All categories
										{:else if recentCategoryFilter === RECENT_TX_FILTER_UNCATEGORIZED}
											Uncategorized
										{:else}
											{recentCategoryFilter}
										{/if}
									</span>
								</Select.Trigger>
								<Select.Content>
									<Select.Item value={RECENT_TX_FILTER_ALL} label="All categories">
										All categories
									</Select.Item>
									{#if filterHasUncategorized}
										<Select.Item value={RECENT_TX_FILTER_UNCATEGORIZED} label="Uncategorized">
											Uncategorized
										</Select.Item>
									{/if}
									{#each recentCategorySelectOptions as cat (cat)}
										<Select.Item value={cat} label={cat}>{cat}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Transaction</Table.Head>
									<Table.Head class="hidden md:table-cell">Account</Table.Head>
									<Table.Head class="hidden md:table-cell">Category</Table.Head>
									<Table.Head class="text-right">Amount</Table.Head>
									<Table.Head class="w-12"><span class="sr-only">Actions</span></Table.Head>
								</Table.Row>
							</Table.Header>
							{#if futureTransactions.length > 0 && upcomingTransactionsOpen}
								{@render transactionGroups(upcomingTransactionGroups, true)}
							{/if}

							{#if postedTransactions.length === 0 && futureTransactions.length === 0}
								<Table.Body>
									<Table.Row class="hover:bg-transparent">
										<Table.Cell colspan={5} class="py-10 text-center text-sm text-muted-foreground">
											No transactions in {DASHBOARD_MONTHS[selectedMonth]} yet.
										</Table.Cell>
									</Table.Row>
								</Table.Body>
							{:else if recentTransactions.length === 0 && upcomingTransactions.length === 0}
								<Table.Body>
									<Table.Row class="hover:bg-transparent">
										<Table.Cell colspan={5} class="py-10 text-center">
											<p class="text-sm text-muted-foreground">
												No transactions match your filters.
											</p>
											<Button variant="link" size="sm" onclick={clearTransactionFilters}>
												Clear filters
											</Button>
										</Table.Cell>
									</Table.Row>
								</Table.Body>
							{:else if recentTransactions.length > 0}
								{@render transactionGroups(recentTransactionGroups, false)}
							{/if}
						</Table.Root>
					</Card.Content>
				</Collapsible.Root>
			</Card.Root>
		</div>

		<!-- Sidebar Content: Budgets & Savings Goal -->
		<div class="flex min-w-0 flex-col gap-6 md:col-span-3">
			<Card.Root>
				<Card.Header>
					<Card.Title>Budgets</Card.Title>
					<Card.Description>{budgetStatusSummary}</Card.Description>
					<Card.Action>
						<Button href="/budgets" variant="ghost" size="icon-sm" aria-label="Add budget">
							<Plus />
						</Button>
					</Card.Action>
				</Card.Header>
				<Card.Content>
					{#if budgets.length === 0}
						<p class="py-4 text-center text-sm text-muted-foreground">No budgets set up yet.</p>
					{:else}
						<ul class="space-y-5">
							{#each budgets as budget (budget.id)}
								{@const spent = budget.periodSpent}
								{@const status = getBudgetStatus(spent, budget.limit)}
								{@const symbol = budget.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL}
								<li class="space-y-2.5">
									<div class="flex items-center gap-3">
										<BudgetIcon icon={budget.icon} color={budget.color} size="sm" />
										<div class="min-w-0 flex-1">
											<div class="flex items-baseline justify-between gap-2 text-sm">
												<span class="truncate font-medium">{budget.category}</span>
												<span class="shrink-0 tabular-nums">
													<span class="font-medium"
														>{formatMoney(spent, symbol, { wholeUnits: true })}</span
													>
													<span class="text-muted-foreground">
														/ {formatMoney(budget.limit, symbol, { wholeUnits: true })}</span
													>
												</span>
											</div>
											<div class="flex items-baseline justify-between gap-2 text-xs">
												<span class="text-muted-foreground capitalize">{budget.period}</span>
												<span class="tabular-nums {BUDGET_STATUS_TEXT_CLASS[status]}">
													{#if status === 'over'}
														{formatMoney(spent - budget.limit, symbol)} over
													{:else}
														{formatMoney(budget.limit - spent, symbol)} left
													{/if}
												</span>
											</div>
										</div>
									</div>
									<Progress
										value={budget.limit > 0 ? Math.min((spent / budget.limit) * 100, 100) : 100}
										class="h-1.5 {BUDGET_PROGRESS_CLASS[status]}"
										aria-label="{budget.category} budget used"
									/>
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
				<Card.Footer>
					<Button href="/budgets" variant="outline" size="sm" class="w-full">Manage budgets</Button>
				</Card.Footer>
			</Card.Root>

			{#if goal && accountWithGoal}
				{@const goalSymbol = accountWithGoal.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL}
				<Card.Root>
					<Card.Header>
						<Card.Title>{goal.name}</Card.Title>
						<Card.Description class="flex items-center gap-2">
							<span
								class="size-2 shrink-0 rounded-full"
								style="background-color: {accountWithGoal.color}"
							></span>
							<span class="truncate">Savings goal · {accountWithGoal.name}</span>
						</Card.Description>
						<Card.Action>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Edit goal"
								onclick={() => openGoalDialog(accountWithGoal)}
							>
								<Pencil />
							</Button>
						</Card.Action>
					</Card.Header>
					<Card.Content class="space-y-3">
						<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<span class="text-3xl font-semibold tracking-tight tabular-nums">
								{formatMoney(currentBalanceForGoalAccount, goalSymbol)}
							</span>
							<span class="text-sm text-muted-foreground tabular-nums">
								of {formatMoney(goal.targetAmount, goalSymbol, { wholeUnits: true })}
							</span>
						</div>
						<Progress
							value={goalProgress}
							class="h-2 bg-savings/15 *:data-[slot=progress-indicator]:bg-savings"
							aria-label="{goal.name} progress"
						/>
						<div class="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
							<span>
								<span class="font-medium text-foreground tabular-nums"
									>{goalProgress.toFixed(0)}%</span
								> saved
							</span>
							<span class="tabular-nums">
								{goalRemaining > 0
									? `${formatMoney(goalRemaining, goalSymbol, { wholeUnits: true })} to go`
									: 'Goal reached'}{goal.targetDate
									? ` · by ${format(new Date(goal.targetDate), 'MMM yyyy')}`
									: ''}
							</span>
						</div>
					</Card.Content>
				</Card.Root>
			{:else}
				<Card.Root class="border-dashed bg-muted/30">
					<Card.Content
						class="flex flex-col items-center justify-center space-y-4 py-4 text-center"
					>
						<div class="rounded-full bg-background p-3 shadow-sm">
							<PiggyBank class="size-6 text-muted-foreground" />
						</div>
						<div class="max-w-[220px] space-y-1">
							<h3 class="text-sm font-semibold">No savings goal</h3>
							<p class="text-sm text-muted-foreground">
								Set a goal on a savings account to track your progress here.
							</p>
						</div>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })}>
								<Target />
								Set a goal
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="center">
								<DropdownMenu.Label>Select account</DropdownMenu.Label>
								<DropdownMenu.Separator />
								{#each savingsAccounts as account (account.id)}
									<DropdownMenu.Item onclick={() => openGoalDialog(account)}>
										<span class="size-2 rounded-full" style="background-color: {account.color}"
										></span>
										{account.name}
									</DropdownMenu.Item>
								{:else}
									<DropdownMenu.Item disabled>No savings accounts yet</DropdownMenu.Item>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	</div>
</div>

{#if goalAccount}
	<SetGoalDialog
		bind:open={goalDialogOpen}
		accountId={goalAccount.id}
		accountName={goalAccount.name}
		existingGoal={goalAccount.goal}
	/>
{/if}

<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Media class="bg-destructive/10 text-destructive">
				<Trash2 />
			</AlertDialog.Media>
			<AlertDialog.Title>Delete transaction?</AlertDialog.Title>
			<AlertDialog.Description>
				{#if pendingDeleteTransaction}
					“{pendingDeleteTransaction.name ?? 'Untitled'}” will be removed and the account balance
					adjusted. This can’t be undone.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={confirmDeleteTransaction}>
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Edit Transaction Dialog -->
{#if editingTransaction}
	<EditTransactionDialog
		transaction={{
			...editingTransaction,
			createdAt: new Date(editingTransaction.createdAt),
			updatedAt: new Date(editingTransaction.updatedAt),
			deletedAt: editingTransaction.deletedAt ? new Date(editingTransaction.deletedAt) : null
		}}
		_accounts={accounts}
		bind:open={editDialogOpen}
	/>
{/if}
