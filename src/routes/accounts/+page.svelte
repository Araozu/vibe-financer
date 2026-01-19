<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import CreateAccountDialog from "$lib/components/account/create-account-dialog.svelte";
	import EditAccountDialog from "$lib/components/account/edit-account-dialog.svelte";
	import { 
		CreditCard, 
		TrendingUp, 
		TrendingDown, 
		Coins,
		ArrowUpRight,
		ArrowDownLeft,
		Wallet,
		ArrowRight
	} from "@lucide/svelte";
	import { scaleTime, scaleLinear } from "d3-scale";
	import { BarChart } from "layerchart";
	import ChartContainer from "$lib/components/ui/chart/chart-container.svelte";
	import type { Account, AccountType } from '$lib/domain/account';
	import type { TransactionType } from '$lib/domain/transaction';

	// Serialized types from API
	interface SerializedAccount extends Omit<Account, 'createdAt' | 'updatedAt'> {
		createdAt: string;
		updatedAt: string;
	}

	// Detailed account type with transactions and chart data
	interface DetailedTransaction {
		id: string;
		accountId: string;
		type: TransactionType;
		amount: number;
		name: string | null;
		description: string | null;
		category: string | null;
		payee: string | null;
		toAccountId: string | null;
		createdAt: string;
		updatedAt: string;
	}

	interface ChartDataPoint {
		date: string;
		balance: number;
	}

	interface DetailedAccount extends Omit<Account, 'createdAt' | 'updatedAt'> {
		createdAt: string;
		updatedAt: string;
		last10Transactions: DetailedTransaction[];
		chartData: ChartDataPoint[];
	}

	// Query for detailed accounts
	const accountsQuery = createQuery<DetailedAccount[]>(() => ({
		queryKey: ['accounts', 'detailed'],
		queryFn: async () => (await fetch('/api/accounts/detailed')).json(),
	}));

	let accounts = $derived(accountsQuery.data ?? []);

	// Also get basic accounts for the transaction dialog
	const basicAccountsQuery = createQuery<SerializedAccount[]>(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json(),
	}));

	let basicAccounts = $derived(basicAccountsQuery.data ?? []);

	const typeIcons: Record<AccountType, typeof CreditCard> = {
		asset: CreditCard,
		expense: TrendingDown,
		revenue: TrendingUp,
		liability: Coins
	};

	const typeLabels: Record<AccountType, string> = {
		asset: "Asset",
		expense: "Expense",
		revenue: "Revenue",
		liability: "Liability"
	};

	function formatAmount(amount: number, currencyCode: string, currencySymbol: string) {
		return (amount / 100).toLocaleString('en-US', {
			style: 'currency',
			currency: currencyCode,
		});
	}

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="flex justify-end gap-2 mb-8">
	<CreateAccountDialog />
</div>

{#if accounts.length === 0}
		<Card.Root class="border-dashed flex flex-col items-center justify-center p-12 text-center">
			<div class="p-4 bg-muted rounded-full mb-4">
				<Wallet class="h-10 w-10 text-muted-foreground/40" />
			</div>
			<Card.Title class="text-xl">No accounts yet</Card.Title>
			<Card.Description class="max-w-xs mx-auto mt-2">
				Create your first account to start tracking your finances and transactions.
			</Card.Description>
			<div class="mt-6">
				<CreateAccountDialog />
			</div>
		</Card.Root>
	{:else}
		<div class="grid gap-8 grid-cols-1">
			{#each accounts as account}
				{@const Icon = typeIcons[account.type] ?? Wallet}
				{@const chartConfig = {
					balance: { label: "Balance", color: account.color }
				} satisfies Chart.ChartConfig}
				{@const chartDataParsed = account.chartData.map((d: ChartDataPoint) => ({ ...d, date: new Date(d.date) }))}
				<Card.Root class="overflow-hidden group hover:border-primary/30 transition-all border-2">
					<Card.Header class="pb-6 border-b bg-muted/10">
						<div class="flex justify-between items-start">
							<div class="flex items-center gap-4">
								<div 
									class="p-2.5 rounded-xl" 
									style="background-color: {account.color}20; color: {account.color}"
								>
									<Icon class="h-6 w-6" />
								</div>
								<div>
									<Card.Title class="text-2xl group-hover:text-primary transition-colors">{account.name}</Card.Title>
									<Card.Description class="line-clamp-1">{account.description ?? 'No description'}</Card.Description>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<EditAccountDialog {account} />
								<Badge variant="secondary" class="text-xs uppercase font-bold tracking-wider px-3 py-1">
									{typeLabels[account.type]}
								</Badge>
							</div>
						</div>
					</Card.Header>
					<Card.Content class="pt-8">
						<div class="flex flex-col gap-1 mb-8">
							<div class="text-sm font-medium text-muted-foreground uppercase tracking-wider">Current Balance</div>
							<div class="flex items-baseline gap-3">
								<div class="text-5xl font-black tracking-tight">
									{formatAmount(account.currentBalance, account.currencyCode, account.currencySymbol)}
								</div>
								<p class="text-sm mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50">
									{#if account.currentBalance >= account.initialBalance}
										<ArrowUpRight class="h-4 w-4 text-emerald-500" />
										<span class="text-emerald-500 font-semibold">
											+{formatAmount(account.currentBalance - account.initialBalance, account.currencyCode, account.currencySymbol)}
										</span>
									{:else}
										<ArrowDownLeft class="h-4 w-4 text-rose-500" />
										<span class="text-rose-500 font-semibold">
											-{formatAmount(account.initialBalance - account.currentBalance, account.currencyCode, account.currencySymbol)}
										</span>
									{/if}
									<span class="text-muted-foreground text-xs">vs initial</span>
								</p>
							</div>
							<div class="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-widest">
								{account.currencyCode} • {account.currencySymbol}
							</div>
						</div>

						<div class="grid grid-cols-[auto_25rem] xl:grid-cols-12 gap-12">
							<!-- Left Column: Chart -->
							<div class="xl:col-span-7">
								<h3 class="text-sm font-bold mb-6 text-muted-foreground uppercase tracking-widest flex items-center gap-2">
									<div class="w-1.5 h-1.5 rounded-full" style="background-color: {account.color}"></div>
									Balance History (MTD)
								</h3>
								<ChartContainer config={chartConfig} class="aspect-auto h-[280px] w-full">
									<BarChart
										data={chartDataParsed}
										x="date"
										y="balance"
										xScale={scaleTime()}
										yScale={scaleLinear()}
										props={{
											bars: {
												fill: account.color,
												radius: 4,
												class: "opacity-80 hover:opacity-100 transition-opacity"
											},
											xAxis: {
												format: (v: Date) => {
													return v.toLocaleDateString("en-US", {
														day: "numeric",
													});
												},
												ticks: 10
											},
											yAxis: { 
												format: (v: number) => v.toLocaleString('en-US', { 
													style: 'currency', 
													currency: account.currencyCode, 
													maximumFractionDigits: 0 
												}),
												ticks: 5
											},
										}}
									>
										{#snippet tooltip()}
											<Chart.Tooltip
												labelFormatter={(v: Date) => {
													return v.toLocaleDateString("en-US", {
														month: "long",
														day: "numeric",
														year: "numeric"
													});
												}}
											/>
										{/snippet}
									</BarChart>
								</ChartContainer>
							</div>

							<!-- Right Column: Transactions -->
							<div class="xl:col-span-5 flex flex-col h-full">
								<div class="flex justify-between items-center mb-6">
									<h3 class="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
										<TrendingUp class="h-4 w-4" />
										Recent Transactions
									</h3>
								</div>
								
								<div class="rounded-xl border bg-card overflow-hidden">
									<Table.Root>
										<Table.Header class="bg-muted/30">
											<Table.Row>
												<Table.Head class="text-[10px] uppercase font-bold tracking-wider">Date</Table.Head>
												<Table.Head class="text-[10px] uppercase font-bold tracking-wider">Name</Table.Head>
												<Table.Head class="text-right text-[10px] uppercase font-bold tracking-wider">Amount</Table.Head>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{#if account.last10Transactions.length === 0}
												<Table.Row>
													<Table.Cell colspan={3} class="text-center py-12 text-muted-foreground">
														No transactions yet.
													</Table.Cell>
												</Table.Row>
											{:else}
												{#each account.last10Transactions as tx}
													<Table.Row class="group transition-colors">
														<Table.Cell class="py-3 text-xs text-muted-foreground font-medium">
															{formatDate(tx.createdAt)}
														</Table.Cell>
														<Table.Cell class="py-3">
															<div class="flex flex-col">
																<span class="font-semibold text-sm line-clamp-1">{tx.name ?? tx.payee ?? 'Untitled'}</span>
																<span class="text-[10px] text-muted-foreground uppercase tracking-tighter">{tx.category ?? 'Uncategorized'}</span>
															</div>
														</Table.Cell>
														<Table.Cell class="text-right py-3 font-bold">
															<span class={tx.type === 'income' ? 'text-emerald-500' : 'text-foreground'}>
																{tx.type === 'income' ? '+' : '-'}{formatAmount(tx.amount, account.currencyCode, account.currencySymbol)}
															</span>
														</Table.Cell>
													</Table.Row>
												{/each}
											{/if}
										</Table.Body>
									</Table.Root>
								</div>
								<div class="mt-4 flex justify-end">
									<Button variant="ghost" size="sm" class="text-xs font-semibold text-muted-foreground hover:text-primary gap-1">
										View all transactions
										<ArrowRight class="h-3 w-3" />
									</Button>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
