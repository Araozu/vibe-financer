<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from "$lib/components/ui/table/index.js";
	import { Progress } from "$lib/components/ui/progress/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import CreateAccountDialog from "$lib/components/account/create-account-dialog.svelte";
	import CreateTransactionDialog from "$lib/components/transaction/create-transaction-dialog.svelte";
	import CreateTransactionForm from "$lib/components/transaction/create-transaction-form.svelte";
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
		Settings
	} from "@lucide/svelte";
	import logo from "$lib/assets/plain_icon.svg";
	import type { Account } from '$lib/domain/account';
	import type { Transaction } from '$lib/domain/transaction';

	// Serialized types from API (dates as strings)
	interface SerializedAccount extends Omit<Account, 'createdAt' | 'updatedAt'> {
		createdAt: string;
		updatedAt: string;
	}

	interface SerializedTransaction extends Omit<Transaction, 'createdAt' | 'updatedAt'> {
		createdAt: string;
		updatedAt: string;
	}

	// Query for accounts
	const accountsQuery = createQuery<SerializedAccount[]>(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json(),
	}));

	// Query for transactions
	const transactionsQuery = createQuery<SerializedTransaction[]>(() => ({
		queryKey: ['transactions'],
		queryFn: async () => (await fetch('/api/transactions')).json(),
	}));

	let accounts = $derived(accountsQuery.data ?? []);
	let transactions = $derived(transactionsQuery.data ?? []);

	let totalBalance = $derived(accounts.reduce((acc: number, curr) => acc + curr.currentBalance, 0));
	let formattedTotalBalance = $derived((totalBalance / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }));

	// Calculate real stats (filtered for current month)
	const now = new Date();
	const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	let monthlyIncome = $derived(transactions
		.filter((tx) => tx.type === 'income' && new Date(tx.createdAt) >= firstDayOfMonth)
		.reduce((acc: number, curr) => acc + curr.amount, 0));
	
	let monthlyExpenses = $derived(transactions
		.filter((tx) => tx.type === 'expense' && new Date(tx.createdAt) >= firstDayOfMonth)
		.reduce((acc: number, curr) => acc + curr.amount, 0));

	let formattedMonthlyIncome = $derived((monthlyIncome / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
	let formattedMonthlyExpenses = $derived((monthlyExpenses / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }));

	let savingsRate = $derived(monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0);

	const summaryStats = $derived([
		{
			title: "Total Balance",
			amount: formattedTotalBalance,
			change: "Overall net worth",
			icon: Wallet,
			color: "text-blue-500"
		},
		{
			title: "Monthly Income",
			amount: formattedMonthlyIncome,
			change: "This calendar month",
			icon: TrendingUp,
			color: "text-emerald-500"
		},
		{
			title: "Monthly Expenses",
			amount: formattedMonthlyExpenses,
			change: "This calendar month",
			icon: TrendingDown,
			color: "text-rose-500"
		},
		{
			title: "Savings Rate",
			amount: `${savingsRate.toFixed(1)}%`,
			change: "Monthly performance",
			icon: PiggyBank,
			color: "text-purple-500"
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

	const budgets = [
		{ name: "Housing", spent: 1800, limit: 1800, color: "bg-blue-500" },
		{ name: "Food & Dining", spent: 450, limit: 600, color: "bg-emerald-500" },
		{ name: "Transport", spent: 120, limit: 200, color: "bg-orange-500" },
		{ name: "Entertainment", spent: 380, limit: 300, color: "bg-rose-500" }
	];

</script>

<div class="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
	<!-- Header -->
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
		<div class="flex items-center gap-4">
			<img src={logo} alt="Vibe Financer" class="h-12 w-12" />
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Financial Dashboard</h1>
				<p class="text-muted-foreground">Welcome back! Here's what's happening with your money.</p>
			</div>
		</div>
		<div class="flex gap-2">
			<a href="/accounts">
				<Button variant="outline" size="sm">
					<Wallet class="mr-2 h-4 w-4" />
					View Accounts
				</Button>
			</a>
			<CreateAccountDialog />
			<CreateTransactionDialog accounts={accounts} />
			<a href="/settings">
				<Button variant="outline" size="sm">
					<Settings class="mr-2 h-4 w-4" />
					Settings
				</Button>
			</a>
			<form method="POST" action="/logout">
				<Button variant="ghost" size="sm" type="submit">
					Logout
				</Button>
			</form>
		</div>
	</div>

	<!-- Summary Grid -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each summaryStats as stat}
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">{stat.title}</Card.Title>
					<stat.icon class="h-4 w-4 {stat.color}" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{stat.amount}</div>
					<p class="text-xs text-muted-foreground mt-1">
						{stat.change}
					</p>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<div class="grid gap-8 md:grid-cols-7">
		<!-- Main Content: Transactions & Charts -->
		<div class="md:col-span-4 space-y-8">
			{#if accounts.length > 0}
				<Card.Root class="overflow-hidden py-0">
					<CreateTransactionForm 
						accounts={accounts} 
						showCreateMore={false} 
					/>
				</Card.Root>
			{:else}
				<Card.Root class="bg-muted/30 border-dashed">
					<Card.Content class="flex flex-col items-center justify-center py-10 text-center space-y-4">
						<div class="p-3 bg-background rounded-full shadow-sm">
							<Wallet class="h-6 w-6 text-muted-foreground" />
						</div>
						<div class="max-w-[250px] space-y-1">
							<h3 class="font-semibold">No accounts found</h3>
							<p class="text-xs text-muted-foreground">You need to create at least one account before you can record transactions.</p>
						</div>
						<CreateAccountDialog />
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Spending Overview (Mock Chart) -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Spending Overview</Card.Title>
					<Card.Description>Your daily spending for the last 7 days</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="h-[200px] w-full flex items-end justify-between gap-2 px-2">
						{#each [45, 60, 35, 80, 55, 90, 40] as height, i}
							<div class="relative group w-full">
								<div 
									class="bg-primary/20 hover:bg-primary transition-colors rounded-t-sm w-full" 
									style="height: {height}%"
								></div>
								<span class="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
									{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
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
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each transactions.slice(0, 10) as tx}
								{@const account = accounts.find((a) => a.id === tx.accountId)}
								{@const Icon = getCategoryIcon(tx.category)}
								<Table.Row>
									<Table.Cell>
										<div class="flex items-center gap-3">
											<div class="p-2 bg-muted rounded-full">
												<Icon class="h-4 w-4" />
											</div>
											<div>
												<div class="font-medium">{tx.name ?? 'Untitled'}</div>
												<div class="text-xs text-muted-foreground">
													{new Date(tx.createdAt).toLocaleDateString()}
												</div>
											</div>
										</div>
									</Table.Cell>
									<Table.Cell class="hidden md:table-cell">
										{#if account}
											<div class="flex items-center gap-2">
												<div class="h-2 w-2 rounded-full" style="background-color: {account.color}"></div>
												<span class="text-xs">{account.name}</span>
											</div>
										{/if}
									</Table.Cell>
									<Table.Cell class="hidden md:table-cell">
										<Badge variant="secondary">{tx.category ?? 'Uncategorized'}</Badge>
									</Table.Cell>
									<Table.Cell class="text-right font-medium {tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}">
										{tx.type === 'income' ? '+' : '-'}{(tx.amount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Sidebar Content: Budgets & Quick Actions -->
		<div class="md:col-span-3 space-y-8">
			<!-- Budgets -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Budgets</Card.Title>
					<Card.Description>Monthly limit tracking</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					{#each budgets as budget}
						<div class="space-y-2">
							<div class="flex items-center justify-between text-sm">
								<span class="font-medium">{budget.name}</span>
								<span class="text-muted-foreground">
									${budget.spent} / <span class="font-semibold">${budget.limit}</span>
								</span>
							</div>
							<Progress value={(budget.spent / budget.limit) * 100} class="h-2" />
							{#if budget.spent > budget.limit}
								<p class="text-[10px] text-rose-500 font-medium">Over budget by ${(budget.spent - budget.limit).toFixed(2)}</p>
							{/if}
						</div>
					{/each}
				</Card.Content>
				<Card.Footer>
					<Button variant="outline" class="w-full" size="sm">Manage Budgets</Button>
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
</div>
