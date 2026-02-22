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
		Info
	} from '@lucide/svelte';
	import type { Account } from '$lib/domain/account';
	import type { Transaction } from '$lib/domain/transaction';
	import { calculateDailySpending } from '$lib/domain/spending-analytics';
	import { formatLocalDate, formatLocalDateTime } from '$lib/domain/date-formatter';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	// Serialized types from API (dates as strings)
	interface SerializedAccount extends Omit<Account, 'createdAt' | 'updatedAt'> {
		createdAt: string;
		updatedAt: string;
	}

	interface SerializedTransaction extends Omit<Transaction, 'createdAt' | 'updatedAt'> {
		createdAt: string;
		updatedAt: string;
	}

	interface SerializedBudget {
		id: string;
		category: string;
		limit: number;
		currentSpent: number;
		currencyId: string;
		period: string;
		color?: string;
	}

	// Query for accounts
	const accountsQuery = createQuery<SerializedAccount[]>(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json()
	}));

	// Query for transactions
	const transactionsQuery = createQuery<SerializedTransaction[]>(() => ({
		queryKey: ['transactions'],
		queryFn: async () => (await fetch('/api/transactions')).json()
	}));

	// Query for budgets
	const budgetsQuery = createQuery<SerializedBudget[]>(() => ({
		queryKey: ['budgets'],
		queryFn: async () => (await fetch('/api/budgets')).json()
	}));

	const queryClient = useQueryClient();

	let accounts = $derived(accountsQuery.data ?? []);
	let transactions = $derived(transactionsQuery.data ?? []);
	let budgets = $derived(budgetsQuery.data ?? []);
	let dailySpending = $derived.by(() => {
		const txs = transactions.map((tx) => ({
			...tx,
			createdAt: new Date(tx.createdAt),
			updatedAt: new Date(tx.updatedAt),
			deletedAt: tx.deletedAt ? new Date(tx.deletedAt) : null
		}));
		return calculateDailySpending(txs, 7);
	});

	let maxSpending = $derived(Math.max(...dailySpending.map((s) => s.amount), 100));

	let editingTransaction = $state<SerializedTransaction | null>(null);
	let editDialogOpen = $state(false);
	let deletingTransactionId = $state<string | null>(null);

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

	// Calculate real stats (filtered for current month)
	const now = new Date();
	const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	let monthlyIncome = $derived(
		transactions
			.filter((tx) => tx.type === 'income' && new Date(tx.createdAt) >= firstDayOfMonth)
			.reduce((acc: number, curr) => acc + curr.amount, 0)
	);

	let monthlyExpenses = $derived(
		transactions
			.filter((tx) => tx.type === 'expense' && new Date(tx.createdAt) >= firstDayOfMonth)
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
			color: 'text-emerald-500'
		},
		{
			title: 'Monthly Expenses',
			amount: formattedMonthlyExpenses,
			change: 'This calendar month',
			icon: TrendingDown,
			color: 'text-rose-500'
		},
		{
			title: 'Savings Rate',
			amount: `${savingsRate.toFixed(1)}%`,
			change: 'Monthly performance',
			icon: PiggyBank,
			color: 'text-purple-500'
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
		'bg-emerald-500',
		'bg-orange-500',
		'bg-rose-500',
		'bg-purple-500',
		'bg-amber-500'
	];
</script>

<!-- Summary Grid -->
<div class="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
	{#each summaryStats as stat}
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
	<!-- Main Content: Transactions & Charts -->
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

		<!-- Spending Overview -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Spending Overview</Card.Title>
				<Card.Description>Your daily spending for the last 7 days</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex h-[200px] w-full items-end justify-between gap-2 px-2">
					{#each dailySpending as day}
						{@const height = maxSpending > 0 ? (day.amount / maxSpending) * 100 : 0}
						<div class="group relative flex h-full w-full flex-col justify-end">
							<div
								class="w-full rounded-t-sm bg-primary/20 transition-all hover:bg-primary"
								style="height: {Math.max(height, 2)}%"
							>
								<div
									class="absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md group-hover:block"
								>
									{(day.amount / 100).toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD'
									})}
								</div>
							</div>
							<span class="mt-2 block w-full text-center text-[10px] text-muted-foreground">
								{day.label}
							</span>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Recent Transactions -->
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
						{#each transactions.slice(0, 10) as tx}
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
										? 'text-emerald-600'
										: 'text-rose-600'}"
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
					{#each budgets as budget, i}
						{@const color = budgetColors[i % budgetColors.length]}
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

		<!-- Savings Goal -->
		<Card.Root class="bg-primary text-primary-foreground">
			<Card.Header>
				<Card.Title class="text-primary-foreground">Savings Goal</Card.Title>
				<Card.Description class="text-primary-foreground/70">New Car Fund</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-4">
					<div class="text-3xl font-bold">$12,400.00</div>
					<div class="space-y-2">
						<div class="flex justify-between text-xs">
							<span>62% achieved</span>
							<span>Goal: $20,000</span>
						</div>
						<Progress value={62} class="h-1.5 bg-primary-foreground/20" />
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- Edit Transaction Dialog -->
{#if editingTransaction}
	<EditTransactionDialog
		transaction={{
			...editingTransaction,
			createdAt: new Date(editingTransaction.createdAt),
			updatedAt: new Date(editingTransaction.updatedAt)
		}}
		{accounts}
		bind:open={editDialogOpen}
	/>
{/if}
