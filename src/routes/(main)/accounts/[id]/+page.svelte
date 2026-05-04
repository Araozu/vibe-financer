<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		CreditCard,
		TrendingUp,
		TrendingDown,
		Coins,
		Wallet,
		Landmark,
		ArrowLeft,
		Pencil,
		Trash2,
		LayoutGrid
	} from '@lucide/svelte';
	import { useQueryClient } from '@tanstack/svelte-query';
	import TransactionsTable from '$lib/components/transaction/transactions-table.svelte';
	import EditAccountDialog from '$lib/components/account/edit-account-dialog.svelte';
	import MtdBalanceChart from '$lib/components/dashboard/mtd-balance-chart.svelte';
	import type { AccountType } from '$lib/domain/account';
	import type { Transaction } from '$lib/domain/transaction';
	import { goto } from '$app/navigation';
	import {
		DASHBOARD_MONTHS,
		getDashboardPeriodContext
	} from '$lib/components/layout/dashboard-period.js';

	type SerializedTransaction = Omit<Transaction, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
		createdAt: string;
		updatedAt: string;
		deletedAt: string | null;
	};

	const queryClient = useQueryClient();

	let isDeleting = $state(false);

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

	const categories = $derived(data.categories ?? []);
	const initialTransactions = $derived(data.initialTransactions ?? []);

	const dashboardPeriod = getDashboardPeriodContext();
	let chartMonth = $derived(dashboardPeriod.month);
	let chartYear = $derived(dashboardPeriod.year);
	const dashboardNow = new Date();

	let isCurrentSelectedMonth = $derived(
		chartMonth === dashboardPeriod.currentMonth && chartYear === dashboardPeriod.currentYear
	);

	const chartQuery = createQuery(() => ({
		queryKey: ['chart-transactions', account.id, chartMonth, chartYear],
		queryFn: async () => {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const res = await fetch(`/api/transactions?month=${chartMonth}&year=${chartYear}&tz=${tz}`);
			if (!res.ok) {
				throw new Error('Failed to load account transactions');
			}
			return res.json();
		}
	}));

	let chartTransactions = $derived(
		(chartQuery.data?.transactions ?? []) as SerializedTransaction[]
	);
	let chartInitialBalances = $derived(chartQuery.data?.initialBalances ?? {});
	let selectedMonthTransactions = $derived(
		chartTransactions.filter(
			(tx: SerializedTransaction) => tx.accountId === account.id || tx.toAccountId === account.id
		)
	);
	let selectedMonthTransactionsForSummary = $derived(
		isCurrentSelectedMonth
			? selectedMonthTransactions.filter(
					(tx: SerializedTransaction) => new Date(tx.createdAt) <= dashboardNow
				)
			: selectedMonthTransactions
	);

	let monthlyIncome = $derived(
		selectedMonthTransactionsForSummary
			.filter((tx: SerializedTransaction) => tx.accountId === account.id && tx.type === 'income')
			.reduce((sum: number, tx: SerializedTransaction) => sum + tx.amount, 0)
	);

	let monthlyExpenses = $derived(
		selectedMonthTransactionsForSummary
			.filter((tx: SerializedTransaction) => tx.accountId === account.id && tx.type === 'expense')
			.reduce((sum: number, tx: SerializedTransaction) => sum + tx.amount, 0)
	);

	let monthlyNet = $derived(monthlyIncome - monthlyExpenses);
	let selectedPeriodBalance = $derived(
		(chartInitialBalances[account.id] ?? 0) +
			selectedMonthTransactionsForSummary.reduce(
				(balanceDelta: number, tx: SerializedTransaction) => {
					if (tx.type === 'income' && tx.accountId === account.id) {
						return balanceDelta + tx.amount;
					}
					if (tx.type === 'expense' && tx.accountId === account.id) {
						return balanceDelta - tx.amount;
					}
					if (tx.type === 'transfer') {
						if (tx.accountId === account.id) return balanceDelta - tx.amount;
						if (tx.toAccountId === account.id) return balanceDelta + tx.amount;
					}
					return balanceDelta;
				},
				0
			)
	);
	let totalTransactionCount = $derived(selectedMonthTransactionsForSummary.length);

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

	const Icon = $derived(typeIcons[account.type as AccountType] ?? Wallet);

	async function fetchTransactionPage(params: {
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
			`type=${encodeURIComponent(params.type)}`,
			`tz=${encodeURIComponent(tz)}`,
			...(params.startDate ? [`startDate=${encodeURIComponent(params.startDate)}`] : []),
			...(params.endDate ? [`endDate=${encodeURIComponent(params.endDate)}`] : []),
			...(params.search ? [`search=${encodeURIComponent(params.search)}`] : []),
			...(params.category ? [`category=${encodeURIComponent(params.category)}`] : [])
		].join('&');

		const res = await fetch(`/api/accounts/${account.id}/transactions?${queryParams}`);
		return await res.json();
	}

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
				{formatAmount(selectedPeriodBalance, account.currencySymbol ?? '$')}
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

<TransactionsTable
	{initialTransactions}
	accounts={[account]}
	{categories}
	queryKeyBase={['accounts', account.id]}
	fetchPage={fetchTransactionPage}
	invalidateQueryKeys={[['accounts'], ['budgets']]}
	showAccountFilter={false}
/>
