<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import CreateAccountDialog from '$lib/components/account/create-account-dialog.svelte';
	import CreateTransactionForm from '$lib/components/transaction/create-transaction-form.svelte';
	import EditTransactionDialog from '$lib/components/transaction/edit-transaction-dialog.svelte';
	import SetGoalDialog from '$lib/components/account/set-goal-dialog.svelte';
	import MtdBalanceChart from '$lib/components/dashboard/mtd-balance-chart.svelte';
	import {
		Wallet,
		TrendingUp,
		TrendingDown,
		PiggyBank,
		Utensils,
		Car,
		Home,
		ShoppingBag,
		Tag,
		MoreVertical,
		Pencil,
		Trash2,
		Plus,
		Info,
		Target,
		Calendar
	} from '@lucide/svelte';
	import type { Account } from '$lib/domain/account';
	import type { Transaction } from '$lib/domain/transaction';

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
		createdAt: string;
		updatedAt: string;
		currencyCode: string | null;
		currencySymbol: string | null;
	};

	import { formatLocalDate, formatLocalDateTime } from '$lib/domain/date-formatter';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

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
			const res = await fetch(`/api/transactions?month=${selectedMonth}&year=${selectedYear}&tz=${tz}`);
			return res.json();
		}
	}));

	// Query for budgets
	const budgetsQuery = createQuery<SerializedBudget[]>(() => ({
		queryKey: ['budgets'],
		queryFn: async () => (await fetch('/api/budgets')).json()
	}));

	const queryClient = useQueryClient();

	let accounts = $derived(accountsQuery.data ?? []);
	let transactions = $derived(transactionsQuery.data?.transactions ?? []);
	let initialBalances = $derived(transactionsQuery.data?.initialBalances ?? {});
	let budgets = $derived(budgetsQuery.data ?? []);

	let editingTransaction = $state<SerializedTransaction | null>(null);
	let editDialogOpen = $state(false);
	let deletingTransactionId = $state<string | null>(null);

	let goalDialogOpen = $state(false);
	let goalAccount = $state<SerializedAccount | null>(null);

	const months = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
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

	let totalBalance = $derived(accounts.reduce((acc: number, curr) => acc + curr.currentBalance, 0));
	let formattedTotalBalance = $derived(
		(totalBalance / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
	);

	// Calculate real stats (filtered for selected month)
	let firstDayOfSelectedMonth = $derived(new Date(Date.UTC(selectedYear, selectedMonth, 1)));
	let lastDayOfSelectedMonth = $derived(new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)));

	let monthlyIncome = $derived(
		transactions
			.filter((tx) => tx.type === 'income' && new Date(tx.createdAt) >= firstDayOfSelectedMonth && new Date(tx.createdAt) <= lastDayOfSelectedMonth)
			.reduce((acc: number, curr) => acc + curr.amount, 0)
	);

	let monthlyExpenses = $derived(
		transactions
			.filter((tx) => tx.type === 'expense' && new Date(tx.createdAt) >= firstDayOfSelectedMonth && new Date(tx.createdAt) <= lastDayOfSelectedMonth)
			.reduce((acc: number, curr) => acc + curr.amount, 0)
	);

	let formattedMonthlyIncome = $derived(
		(monthlyIncome / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
	);
	let formattedMonthlyExpenses = $derived(
		(monthlyExpenses / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
	);

	let savingsRate = $derived(
		monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0
	);

	// Find the first account with a goal to show in the dashboard
	let accountWithGoal = $derived(accounts.find((a) => a.goal !== null));
	let goal = $derived(accountWithGoal?.goal);
	let goalProgress = $derived(
		goal && accountWithGoal
			? Math.min((accountWithGoal.currentBalance / goal.targetAmount) * 100, 100)
			: 0
	);

	const summaryStats = $derived([
		{
			title: 'Total Balance',
			amount: formattedTotalBalance,
			change: 'Overall net worth',
			icon: Wallet,
			color: 'text-blue-500'
		},
		{
			title: 'Monthly Income',
			amount: formattedMonthlyIncome,
			change: 'This calendar month',
			icon: TrendingUp,
			color: 'text-income'
		},
		{
			title: 'Monthly Expenses',
			amount: formattedMonthlyExpenses,
			change: 'This calendar month',
			icon: TrendingDown,
			color: 'text-expense'
		},
		{
			title: 'Savings Rate',
			amount: `${savingsRate.toFixed(1)}%`,
			change: 'Monthly performance',
			icon: PiggyBank,
			color: 'text-savings'
		}
	]);

	// Icon mapping for categories (simplified for now)
	function getCategoryIcon(category: string | null) {
		if (!category) return Tag;
		const cat = category.toLowerCase();
		if (cat.includes('food') || cat.includes('eat')) return Utensils;
		if (cat.includes('car') || cat.includes('transport')) return Car;
		if (cat.includes('home') || cat.includes('rent')) return Home;
		if (cat.includes('shop')) return ShoppingBag;
		if (cat.includes('income') || cat.includes('salary')) return TrendingUp;
		return Tag;
	}

	// Budgets
	const budgetColors = [
		'bg-blue-500',
		'bg-income',
		'bg-orange-500',
		'bg-expense',
		'bg-savings',
		'bg-amber-500'
	];
</script>

<!-- Summary Grid -->
<div class="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
	<div class="flex items-center gap-3">
		<div class="flex h-10 items-center gap-2 rounded-xl border bg-card px-3 shadow-sm">
			<Calendar class="h-4 w-4 text-muted-foreground" />
			<select
				bind:value={selectedMonth}
				class="bg-transparent text-sm font-bold focus:outline-none"
			>
				{#each months as month, i}
					<option value={i}>{month}</option>
				{/each}
			</select>
			<div class="h-4 w-px bg-border"></div>
			<select
				bind:value={selectedYear}
				class="bg-transparent text-sm font-bold focus:outline-none"
			>
				{#each years as year}
					<option value={year}>{year}</option>
				{/each}
			</select>
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

<div class="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
	{#each summaryStats as stat (stat.title)}
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">{stat.title}</Card.Title>
				<stat.icon class="h-4 w-4 {stat.color}" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stat.amount}</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{stat.change}
				</p>
			</Card.Content>
		</Card.Root>
	{/each}
</div>

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
			<Card.Root class="relative overflow-hidden border-none bg-muted/40 shadow-sm transition-all hover:bg-muted/50">
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
								{(accountWithGoal.currentBalance / 100).toLocaleString('en-US', {
									style: 'currency',
									currency: accountWithGoal.currencyCode ?? 'USD'
								})}
							</span>
						</div>
						<div class="space-y-2">
							<div class="flex justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
								<span>{goalProgress.toFixed(0)}% achieved</span>
								<span>
									Goal: {(goal.targetAmount / 100).toLocaleString('en-US', {
										style: 'currency',
										currency: accountWithGoal.currencyCode ?? 'USD',
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
						<h3 class="font-semibold text-sm">No savings goal</h3>
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
										<div class="h-2 w-2 rounded-full" style="background-color: {account.color}"></div>
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
						{#each transactions.slice(0, 10) as tx (tx.id)}
							{@const account = accounts.find((a) => a.id === tx.accountId)}
							{@const Icon = getCategoryIcon(tx.category)}
							<Table.Row>
								<Table.Cell>
									<div class="flex items-center gap-3">
										<div class="rounded-full bg-muted p-2">
											<Icon class="h-4 w-4" />
										</div>
										<div>
											<div class="font-medium">{tx.name ?? 'Untitled'}</div>
											<Tooltip.Provider>
												<Tooltip.Root>
													<Tooltip.Trigger>
														<div class="text-xs text-muted-foreground">
															{formatLocalDate(tx.createdAt)}
														</div>
													</Tooltip.Trigger>
													<Tooltip.Content>
														<div class="flex flex-col gap-1 p-1">
															<div
																class="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase"
															>
																<Info class="h-3 w-3" />
																Full Timestamp
															</div>
															<div class="text-xs font-medium">
																{formatLocalDateTime(tx.createdAt)}
															</div>
															<div class="text-[10px] text-muted-foreground/80 italic">
																{new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' })
																	.format(new Date(tx.createdAt))
																	.split(', ')[1]}
															</div>
														</div>
													</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>
										</div>
									</div>
								</Table.Cell>
								<Table.Cell class="hidden md:table-cell">
									{#if account}
										<div class="flex items-center gap-2">
											<div
												class="h-2 w-2 rounded-full"
												style="background-color: {account.color}"
											></div>
											<span class="text-xs">{account.name}</span>
										</div>
									{/if}
								</Table.Cell>
								<Table.Cell class="hidden md:table-cell">
									<Badge variant="secondary">{tx.category ?? 'Uncategorized'}</Badge>
								</Table.Cell>
								<Table.Cell
									class="text-right font-medium {tx.type === 'income'
										? 'text-income'
										: 'text-expense'}"
								>
									{tx.type === 'income' ? '+' : '-'}{(tx.amount / 100).toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD'
									})}
								</Table.Cell>
								<Table.Cell>
									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											<Button variant="ghost" size="icon" class="h-8 w-8">
												<MoreVertical class="h-4 w-4" />
												<span class="sr-only">Open menu</span>
											</Button>
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end">
											<DropdownMenu.Label>Actions</DropdownMenu.Label>
											<DropdownMenu.Separator />
											<DropdownMenu.Item onclick={() => openEditDialog(tx)}>
												<Pencil class="mr-2 h-4 w-4" />
												Edit
											</DropdownMenu.Item>
											<DropdownMenu.Item
												class="text-destructive"
												onclick={() => handleDeleteTransaction(tx.id)}
												disabled={deletingTransactionId === tx.id}
											>
												<Trash2 class="mr-2 h-4 w-4" />
												{deletingTransactionId === tx.id ? 'Deleting...' : 'Delete'}
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
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
					<Card.Description>Monthly limit tracking</Card.Description>
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
						<div class="space-y-2">
							<div class="flex items-center justify-between text-sm">
								<span class="font-medium">{budget.category}</span>
								<span class="text-muted-foreground">
									${(budget.currentSpent / 100).toFixed(0)} /
									<span class="font-semibold">${(budget.limit / 100).toFixed(0)}</span>
								</span>
							</div>
							<Progress
								value={Math.min((budget.currentSpent / budget.limit) * 100, 100)}
								class="h-2"
							/>
							{#if budget.currentSpent > budget.limit}
								<p class="text-[10px] font-medium text-rose-500">
									Over budget by ${((budget.currentSpent - budget.limit) / 100).toFixed(2)}
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
