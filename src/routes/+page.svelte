<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import CreateAccountDialog from '$lib/components/account/create-account-dialog.svelte';
	import CreateTransactionForm from '$lib/components/transaction/create-transaction-form.svelte';
	import EditTransactionDialog from '$lib/components/transaction/edit-transaction-dialog.svelte';
	import SetGoalDialog from '$lib/components/account/set-goal-dialog.svelte';
	import MtdBalanceChart from '$lib/components/dashboard/mtd-balance-chart.svelte';
	import TransactionRow from '$lib/components/transaction/transaction-row.svelte';
	import {
		Wallet,
		TrendingUp,
		TrendingDown,
		PiggyBank,
		Plus,
		Target,
		Calendar,
		CalendarClock,
		ChevronDown,
		Pencil
	} from '@lucide/svelte';
	import type { Account } from '$lib/domain/account';
	import type { Transaction } from '$lib/domain/transaction';
	import { DEFAULT_CURRENCY_SYMBOL } from '$lib/domain/currency';

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
		period: 'monthly' | 'weekly' | 'yearly';
		startDate: string;
		currentSpent: number;
		periodSpent: number;
		createdAt: string;
		updatedAt: string;
		currencyCode: string | null;
		currencySymbol: string | null;
	};

	let { data: _data } = $props();

	// Month/Year selection for dashboard
	const dashboardNow = new Date();
	let selectedMonth = $state(dashboardNow.getUTCMonth());
	let selectedYear = $state(dashboardNow.getUTCFullYear());

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
		queryKey: ['budgets'],
		queryFn: async () => {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			return (await fetch(`/api/budgets?tz=${tz}`)).json();
		}
	}));

	// Query for user (to get defaultAccountId)
	const userQuery = createQuery<{ defaultAccountId: string | null }>(() => ({
		queryKey: ['user'],
		queryFn: async () => (await fetch('/api/user')).json()
	}));

	const queryClient = useQueryClient();

	let accounts = $derived(accountsQuery.data ?? []);
	let transactions = $derived(transactionsQuery.data?.transactions ?? []);
	let initialBalances = $derived(transactionsQuery.data?.initialBalances ?? {});
	let budgets = $derived(budgetsQuery.data ?? []);
	let defaultAccountId = $derived(userQuery.data?.defaultAccountId ?? null);
	let defaultAccount = $derived(accounts.find((a) => a.id === defaultAccountId) ?? null);

	let editingTransaction = $state<SerializedTransaction | null>(null);
	let editDialogOpen = $state(false);
	let deletingTransactionId = $state<string | null>(null);
	let upcomingTransactionsOpen = $state(false);

	let goalDialogOpen = $state(false);
	let goalAccount = $state<SerializedAccount | null>(null);

	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	const years = Array.from({ length: 5 }, (_, i) => dashboardNow.getUTCFullYear() - 2 + i);

	function openGoalDialog(account: SerializedAccount) {
		goalAccount = account;
		goalDialogOpen = true;
	}

	function openEditDialog(tx: SerializedTransaction) {
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

			// Invalidate queries to refresh the UI
			await queryClient.invalidateQueries({ queryKey: ['transactions'] });
			await queryClient.invalidateQueries({ queryKey: ['accounts'] });
		} catch (error) {
			console.error('Error deleting transaction:', error);
			alert(error instanceof Error ? error.message : 'Failed to delete transaction');
		} finally {
			deletingTransactionId = null;
		}
	}

	// Calculate real stats (filtered for selected month and capped at today)
	let firstDayOfSelectedMonth = $derived(new Date(Date.UTC(selectedYear, selectedMonth, 1)));
	let lastDayOfSelectedMonth = $derived(
		new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999))
	);

	let isCurrentMonth = $derived(
		selectedMonth === dashboardNow.getUTCMonth() && selectedYear === dashboardNow.getUTCFullYear()
	);

	let effectiveEndDate = $derived(isCurrentMonth ? dashboardNow : lastDayOfSelectedMonth);

	let defaultCurrencySymbol = $derived(defaultAccount?.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL);
	const tomorrowStart = new Date();
	tomorrowStart.setHours(24, 0, 0, 0);

	let recentTransactions = $derived(
		transactions.filter((tx) => new Date(tx.createdAt) < tomorrowStart).slice(0, 10)
	);

	let upcomingTransactions = $derived(
		transactions.filter((tx) => new Date(tx.createdAt) >= tomorrowStart).slice(0, 10)
	);

	let defaultAccountTransactions = $derived(
		defaultAccount ? transactions.filter((tx) => tx.accountId === defaultAccount.id) : []
	);

	let totalBalance = $derived.by(() => {
		if (!defaultAccount) return 0;
		const initialBalance = initialBalances[defaultAccount.id] ?? 0;
		return (
			initialBalance +
			defaultAccountTransactions
				.filter((tx) => new Date(tx.createdAt) <= effectiveEndDate)
				.reduce((acc: number, tx) => {
					if (tx.type === 'income') return acc + tx.amount;
					if (tx.type === 'expense') return acc - tx.amount;
					return acc;
				}, 0)
		);
	});

	function formatWithSymbol(amountInCents: number, symbol: string): string {
		return `${symbol}${(amountInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	let formattedTotalBalance = $derived(formatWithSymbol(totalBalance, defaultCurrencySymbol));

	// Projected balance at the end of the selected month (includes future-dated transactions
	// within the selected month, e.g. scheduled bills or upcoming income).
	let projectedEndOfMonthBalance = $derived.by(() => {
		if (!defaultAccount) return 0;
		const initialBalance = initialBalances[defaultAccount.id] ?? 0;
		return (
			initialBalance +
			defaultAccountTransactions
				.filter((tx) => new Date(tx.createdAt) <= lastDayOfSelectedMonth)
				.reduce((acc: number, tx) => {
					if (tx.type === 'income') return acc + tx.amount;
					if (tx.type === 'expense') return acc - tx.amount;
					return acc;
				}, 0)
		);
	});

	let formattedProjectedEndOfMonthBalance = $derived(
		formatWithSymbol(projectedEndOfMonthBalance, defaultCurrencySymbol)
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

	let formattedMonthlyIncome = $derived(formatWithSymbol(monthlyIncome, defaultCurrencySymbol));
	let formattedMonthlyExpenses = $derived(formatWithSymbol(monthlyExpenses, defaultCurrencySymbol));

	let savingsRate = $derived(
		monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0
	);

	// Find the first account with a goal to show in the dashboard
	let accountWithGoal = $derived(accounts.find((a) => a.goal !== null));
	let goal = $derived(accountWithGoal?.goal);

	let currentBalanceForGoalAccount = $derived.by(() => {
		if (!accountWithGoal) return 0;

		const initialBalance = initialBalances[accountWithGoal.id] || 0;
		const netChange = transactions
			.filter(
				(tx) => tx.accountId === accountWithGoal.id && new Date(tx.createdAt) <= effectiveEndDate
			)
			.reduce((acc, tx) => {
				if (tx.type === 'income') return acc + tx.amount;
				if (tx.type === 'expense') return acc - tx.amount;
				return acc;
			}, 0);

		return initialBalance + netChange;
	});

	let goalProgress = $derived(
		goal && accountWithGoal
			? Math.min((currentBalanceForGoalAccount / goal.targetAmount) * 100, 100)
			: 0
	);

	const summaryStats = $derived([
		{
			title: 'Total Balance',
			amount: formattedTotalBalance,
			subtitle: defaultAccount?.name ?? '',
			icon: Wallet,
			color: 'text-blue-500'
		},
		{
			title: 'Projected (End of Month)',
			amount: formattedProjectedEndOfMonthBalance,
			subtitle: `Incl. upcoming · ${months[selectedMonth]}`,
			icon: CalendarClock,
			color: 'text-savings'
		},
		{
			title: 'Monthly Income',
			amount: formattedMonthlyIncome,
			subtitle: isCurrentMonth ? '1st until today' : 'Full month',
			icon: TrendingUp,
			color: 'text-income'
		},
		{
			title: 'Monthly Expenses',
			amount: formattedMonthlyExpenses,
			subtitle: isCurrentMonth ? '1st until today' : 'Full month',
			icon: TrendingDown,
			color: 'text-expense'
		},
		{
			title: 'Savings Rate',
			amount: `${savingsRate.toFixed(1)}%`,
			subtitle: 'Monthly performance',
			icon: PiggyBank,
			color: 'text-savings'
		}
	]);

	const budgetColors = [
		'bg-blue-500',
		'bg-income',
		'bg-orange-500',
		'bg-expense',
		'bg-savings',
		'bg-amber-500'
	];
</script>

<svelte:head>
	<title>Dashboard - {months[selectedMonth]} {selectedYear}</title>
</svelte:head>

<!-- Summary Grid -->
<div class="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
	<div class="flex items-center gap-3">
		<div class="flex h-10 items-center gap-1 rounded-xl border px-2 shadow-sm">
			<Calendar class="ml-1 h-4 w-4 text-muted-foreground" />

			<Select.Root
				type="single"
				value={selectedMonth.toString()}
				onValueChange={(v) => (selectedMonth = parseInt(v))}
			>
				<Select.Trigger
					class="h-8 border-none bg-transparent px-2 text-sm font-bold transition-colors hover:bg-muted/50 focus:ring-0 focus:outline-none data-[placeholder]:text-foreground"
				>
					{months[selectedMonth]}
				</Select.Trigger>
				<Select.Content>
					{#each months as month, i (i)}
						<Select.Item value={i.toString()} label={month}>{month}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<div class="mx-0.5 h-4 w-px bg-border"></div>

			<Select.Root
				type="single"
				value={selectedYear.toString()}
				onValueChange={(v) => (selectedYear = parseInt(v))}
			>
				<Select.Trigger
					class="h-8 border-none bg-transparent px-2 text-sm font-bold transition-colors hover:bg-muted/50 focus:ring-0 focus:outline-none data-[placeholder]:text-foreground"
				>
					{selectedYear}
				</Select.Trigger>
				<Select.Content>
					{#each years as year (year)}
						<Select.Item value={year.toString()} label={year.toString()}>{year}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		{#if selectedMonth !== dashboardNow.getUTCMonth() || selectedYear !== dashboardNow.getUTCFullYear()}
			<Button
				variant="ghost"
				size="sm"
				onclick={() => {
					selectedMonth = dashboardNow.getUTCMonth();
					selectedYear = dashboardNow.getUTCFullYear();
				}}
				class="text-[10px] font-bold tracking-widest uppercase"
			>
				Reset to Today
			</Button>
		{/if}
	</div>
</div>

{#if defaultAccount}
	<!-- Mobile-only compact summary: keeps focus on the create transaction card -->
	<div
		class="mb-6 flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3 shadow-sm md:hidden"
	>
		<div class="flex items-center gap-2">
			<Wallet class="h-4 w-4 text-blue-500" />
			<div class="flex flex-col">
				<span class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
					Now
				</span>
				<span class="text-base leading-tight font-bold tracking-tight">
					{formattedTotalBalance}
				</span>
			</div>
		</div>
		<div class="h-8 w-px bg-border"></div>
		<div class="flex items-center gap-2">
			<CalendarClock class="h-4 w-4 text-savings" />
			<div class="flex flex-col">
				<span class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
					End of month
				</span>
				<span class="text-base leading-tight font-bold tracking-tight">
					{formattedProjectedEndOfMonthBalance}
				</span>
			</div>
		</div>
	</div>

	<div class="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-5">
		{#each summaryStats as stat (stat.title)}
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">{stat.title}</Card.Title>
					<stat.icon class="h-4 w-4 {stat.color}" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{stat.amount}</div>
					<p class="mt-1 text-xs text-muted-foreground">
						{stat.subtitle}
					</p>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{:else}
	<Card.Root class="mb-0 hidden border-dashed bg-muted/30 md:block">
		<Card.Content class="flex items-center justify-center gap-3 py-6 text-center">
			<Wallet class="h-5 w-5 text-muted-foreground" />
			<p class="text-sm text-muted-foreground">
				Set a <a href="/settings" class="font-medium text-primary underline underline-offset-4"
					>default account</a
				> in settings to see your summary stats here.
			</p>
		</Card.Content>
	</Card.Root>
{/if}

<div class="grid gap-8 md:grid-cols-7">
	<div class="space-y-8 md:col-span-4">
		{#if accounts.length > 0}
			<Card.Root class="overflow-hidden py-0">
				<CreateTransactionForm {accounts} showCreateMore={false} />
			</Card.Root>
		{:else}
			<Card.Root class="border-dashed bg-muted/30">
				<Card.Content class="flex flex-col items-center justify-center space-y-4 py-10 text-center">
					<div class="rounded-full bg-background p-3 shadow-sm">
						<Wallet class="h-6 w-6 text-muted-foreground" />
					</div>
					<div class="max-w-[250px] space-y-1">
						<h3 class="font-semibold">No accounts found</h3>
						<p class="text-xs text-muted-foreground">
							You need to create at least one account before you can record transactions.
						</p>
					</div>
					<CreateAccountDialog />
				</Card.Content>
			</Card.Root>
		{/if}
	</div>

	<div class="md:col-span-3">
		<!-- Savings Goal -->
		{#if goal && accountWithGoal}
			<Card.Root
				class="relative overflow-hidden border-none bg-muted/40 shadow-sm transition-all hover:bg-muted/50"
			>
				<div
					class="absolute top-0 left-0 h-full w-1"
					style="background-color: {accountWithGoal.color}"
				></div>
				<Card.Header class="pb-2">
					<div class="flex items-center justify-between">
						<Card.Title class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
							Savings Goal
						</Card.Title>
						<PiggyBank class="h-4 w-4 text-muted-foreground/60" />
					</div>
					<Card.Description class="text-base font-semibold text-foreground">
						{goal.name}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<div class="flex items-baseline gap-1">
							<span class="text-3xl font-bold tracking-tight">
								{accountWithGoal.currencySymbol ?? '$'}{(
									currentBalanceForGoalAccount / 100
								).toLocaleString('en-US', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})}
							</span>
						</div>
						<div class="space-y-2">
							<div
								class="flex justify-between text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
							>
								<span>{goalProgress.toFixed(0)}% achieved</span>
								<span>
									Goal: {accountWithGoal.currencySymbol ?? '$'}{(
										goal.targetAmount / 100
									).toLocaleString('en-US', {
										maximumFractionDigits: 0
									})}
								</span>
							</div>
							<Progress value={goalProgress} class="h-1.5" />
						</div>
					</div>
				</Card.Content>
				<Card.Footer class="pt-0">
					<Button
						variant="ghost"
						size="sm"
						class="h-8 w-full text-xs text-muted-foreground hover:bg-background/50 hover:text-foreground"
						onclick={() => openGoalDialog(accountWithGoal)}
					>
						<Pencil class="mr-2 h-3 w-3" />
						Edit Goal
					</Button>
				</Card.Footer>
			</Card.Root>
		{:else}
			<Card.Root class="border-dashed bg-muted/30">
				<Card.Content class="flex flex-col items-center justify-center space-y-4 py-10 text-center">
					<div class="rounded-full bg-background p-3 shadow-sm">
						<PiggyBank class="h-6 w-6 text-muted-foreground" />
					</div>
					<div class="max-w-[200px] space-y-1">
						<h3 class="text-sm font-semibold">No savings goal</h3>
						<p class="text-xs text-muted-foreground">
							Set a goal for one of your accounts to track your progress here.
						</p>
					</div>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button variant="outline" size="sm">
								<Target class="mr-2 h-4 w-4" />
								Set a Goal
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="center">
							<DropdownMenu.Label>Select Account</DropdownMenu.Label>
							<DropdownMenu.Separator />
							{#each accounts.filter((a) => a.type === 'savings') as account (account.id)}
								<DropdownMenu.Item onclick={() => openGoalDialog(account)}>
									<div class="flex items-center gap-2">
										<div
											class="h-2 w-2 rounded-full"
											style="background-color: {account.color}"
										></div>
										<span>{account.name}</span>
									</div>
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</div>

<div class="mt-8">
	<MtdBalanceChart {accounts} {transactions} {initialBalances} {selectedMonth} {selectedYear} />
</div>

{#if goalAccount}
	<SetGoalDialog
		bind:open={goalDialogOpen}
		accountId={goalAccount.id}
		accountName={goalAccount.name}
		existingGoal={goalAccount.goal}
	/>
{/if}

<div class="mt-8 grid gap-8 md:grid-cols-7">
	<!-- Main Content -->
	<div class="space-y-8 md:col-span-4">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between">
				<div>
					<Card.Title>Recent Transactions</Card.Title>
					<Card.Description>You have {transactions.length} transactions recorded.</Card.Description>
				</div>
				<Button variant="ghost" size="sm">View All</Button>
			</Card.Header>
			<Card.Content>
				<div class="space-y-4">
					{#if upcomingTransactions.length > 0}
						<Collapsible.Root bind:open={upcomingTransactionsOpen} class="space-y-3">
							<Collapsible.Trigger
								class={`${buttonVariants({ variant: 'ghost', size: 'sm' })} w-full justify-between px-2 text-muted-foreground hover:text-foreground`}
							>
								<span>Upcoming transactions ({upcomingTransactions.length})</span>
								<ChevronDown
									class={`h-4 w-4 transition-transform ${upcomingTransactionsOpen ? 'rotate-180' : ''}`}
								/>
							</Collapsible.Trigger>
							<Collapsible.Content>
								<Table.Root>
									<Table.Body>
										{#each upcomingTransactions as tx (tx.id)}
											<TransactionRow
												{tx}
												account={accounts.find((a) => a.id === tx.accountId) ?? null}
												{deletingTransactionId}
												onEdit={openEditDialog}
												onDelete={handleDeleteTransaction}
											/>
										{/each}
									</Table.Body>
								</Table.Root>
							</Collapsible.Content>
						</Collapsible.Root>
					{/if}

					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Transaction</Table.Head>
								<Table.Head class="hidden md:table-cell">Account</Table.Head>
								<Table.Head class="hidden md:table-cell">Category</Table.Head>
								<Table.Head class="text-right">Amount</Table.Head>
								<Table.Head class="w-12"></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if recentTransactions.length === 0}
								<Table.Row>
									<Table.Cell colspan={5} class="py-6 text-center text-sm text-muted-foreground">
										No posted transactions yet for this view.
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each recentTransactions as tx (tx.id)}
									<TransactionRow
										{tx}
										account={accounts.find((a) => a.id === tx.accountId) ?? null}
										{deletingTransactionId}
										onEdit={openEditDialog}
										onDelete={handleDeleteTransaction}
									/>
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>

				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Sidebar Content: Budgets & Quick Actions -->
	<div class="space-y-8 md:col-span-3">
		<!-- Budgets -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between">
				<div>
					<Card.Title>Budgets</Card.Title>
					<Card.Description>Budget tracking by period</Card.Description>
				</div>
				<a href="/budgets">
					<Button variant="ghost" size="icon" class="h-8 w-8">
						<Plus class="h-4 w-4" />
					</Button>
				</a>
			</Card.Header>
			<Card.Content class="space-y-6">
				{#if budgets.length === 0}
					<div class="py-4 text-center text-sm text-muted-foreground">No budgets set up yet.</div>
				{:else}
					{#each budgets as budget, i (budget.id)}
						{@const _color = budgetColors[i % budgetColors.length]}
						{@const spent = budget.periodSpent}
						<div class="space-y-2">
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-center gap-2">
									<span class="font-medium">{budget.category}</span>
									<Badge variant="outline" class="text-[10px] capitalize">{budget.period}</Badge>
								</div>
								<span class="text-muted-foreground">
									{budget.currencySymbol ?? '$'}{(spent / 100).toFixed(0)} /
									<span class="font-semibold"
										>{budget.currencySymbol ?? '$'}{(budget.limit / 100).toFixed(0)}</span
									>
								</span>
							</div>
							<Progress value={Math.min((spent / budget.limit) * 100, 100)} class="h-2" />
							{#if spent > budget.limit}
								<p class="text-[10px] font-medium text-rose-500">
									Over budget by {budget.currencySymbol ?? '$'}{(
										(spent - budget.limit) /
										100
									).toFixed(2)}
								</p>
							{/if}
						</div>
					{/each}
				{/if}
			</Card.Content>
			<Card.Footer>
				<a href="/budgets" class="w-full">
					<Button variant="outline" class="w-full" size="sm">Manage Budgets</Button>
				</a>
			</Card.Footer>
		</Card.Root>
	</div>
</div>

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
