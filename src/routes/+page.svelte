<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from "$lib/components/ui/table/index.js";
	import { Progress } from "$lib/components/ui/progress/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import CreateAccountDialog from "$lib/components/account/create-account-dialog.svelte";
	import { 
		Wallet, 
		TrendingUp, 
		TrendingDown, 
		PiggyBank, 
		Plus, 
		CreditCard,
		Utensils,
		Car,
		Home,
		ShoppingBag
	} from "@lucide/svelte";
	import logo from "$lib/assets/plain_icon.svg";

	let { data } = $props();

	let totalBalance = $derived(data.accounts?.reduce((acc, curr) => acc + curr.currentBalance, 0) || 0);
	let formattedTotalBalance = $derived((totalBalance / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }));

	// Mock Data for UI demonstration
	const summaryStats = $derived([
		{
			title: "Total Balance",
			amount: formattedTotalBalance,
			change: "+2.5% from last month",
			icon: Wallet,
			color: "text-blue-500"
		},
		{
			title: "Monthly Income",
			amount: "$4,200.00",
			change: "+10% from last month",
			icon: TrendingUp,
			color: "text-emerald-500"
		},
		{
			title: "Monthly Expenses",
			amount: "$2,150.00",
			change: "-4.3% from last month",
			icon: TrendingDown,
			color: "text-rose-500"
		},
		{
			title: "Savings Rate",
			amount: "48.8%",
			change: "+5.2% from last month",
			icon: PiggyBank,
			color: "text-purple-500"
		}
	]);

	const recentTransactions = [
		{
			id: "1",
			date: "2024-03-10",
			description: "Apple Store",
			category: "Electronics",
			amount: -1299.00,
			type: "expense",
			icon: ShoppingBag
		},
		{
			id: "2",
			date: "2024-03-09",
			description: "Salary Deposit",
			category: "Income",
			amount: 4200.00,
			type: "income",
			icon: TrendingUp
		},
		{
			id: "3",
			date: "2024-03-08",
			description: "Whole Foods",
			category: "Groceries",
			amount: -152.40,
			type: "expense",
			icon: Utensils
		},
		{
			id: "4",
			date: "2024-03-07",
			description: "Gas Station",
			category: "Transport",
			amount: -45.00,
			type: "expense",
			icon: Car
		},
		{
			id: "5",
			date: "2024-03-06",
			description: "Rent Payment",
			category: "Housing",
			amount: -1800.00,
			type: "expense",
			icon: Home
		}
	];

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
			<Button size="sm">
				<Plus class="mr-2 h-4 w-4" />
				Add Transaction
			</Button>
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
						<Card.Description>You have 12 transactions this week.</Card.Description>
					</div>
					<Button variant="ghost" size="sm">View All</Button>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Transaction</Table.Head>
								<Table.Head class="hidden md:table-cell">Category</Table.Head>
								<Table.Head class="text-right">Amount</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each recentTransactions as tx}
								<Table.Row>
									<Table.Cell>
										<div class="flex items-center gap-3">
											<div class="p-2 bg-muted rounded-full">
												<tx.icon class="h-4 w-4" />
											</div>
											<div>
												<div class="font-medium">{tx.description}</div>
												<div class="text-xs text-muted-foreground">{tx.date}</div>
											</div>
										</div>
									</Table.Cell>
									<Table.Cell class="hidden md:table-cell">
										<Badge variant="secondary">{tx.category}</Badge>
									</Table.Cell>
									<Table.Cell class="text-right font-medium {tx.type === 'income' ? 'text-emerald-600' : ''}">
										{tx.type === 'income' ? '+' : ''}{tx.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
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
