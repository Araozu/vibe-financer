<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import CreateAccountDialog from '$lib/components/account/create-account-dialog.svelte';
	import EditAccountDialog from '$lib/components/account/edit-account-dialog.svelte';
	import {
		CreditCard,
		TrendingUp,
		TrendingDown,
		Coins,
		ArrowUpRight,
		ArrowDownLeft,
		Wallet,
		ArrowRight
	} from '@lucide/svelte';
	import { scaleTime, scaleLinear } from 'd3-scale';
	import { BarChart } from 'layerchart';
	import ChartContainer from '$lib/components/ui/chart/chart-container.svelte';
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
		queryFn: async () => (await fetch('/api/accounts/detailed')).json()
	}));

	let accounts = $derived(accountsQuery.data ?? []);

	// Also get basic accounts for the transaction dialog
	const basicAccountsQuery = createQuery<SerializedAccount[]>(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json()
	}));

	let basicAccounts = $derived(basicAccountsQuery.data ?? []);

	const typeIcons: Record<AccountType, typeof CreditCard> = {
		asset: CreditCard,
		expense: TrendingDown,
		revenue: TrendingUp,
		liability: Coins
	};

	const typeLabels: Record<AccountType, string> = {
		asset: 'Asset',
		expense: 'Expense',
		revenue: 'Revenue',
		liability: 'Liability'
	};

	function formatAmount(amount: number, currencyCode: string, currencySymbol: string) {
		return (amount / 100).toLocaleString('en-US', {
			style: 'currency',
			currency: currencyCode
		});
	}

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="mb-8 flex justify-end gap-2">
	<CreateAccountDialog />
</div>

{#if accounts.length === 0}
	<Card.Root class="flex flex-col items-center justify-center border-dashed p-12 text-center">
		<div class="mb-4 rounded-full bg-muted p-4">
			<Wallet class="h-10 w-10 text-muted-foreground/40" />
		</div>
		<Card.Title class="text-xl">No accounts yet</Card.Title>
		<Card.Description class="mx-auto mt-2 max-w-xs">
			Create your first account to start tracking your finances and transactions.
		</Card.Description>
		<div class="mt-6">
			<CreateAccountDialog />
		</div>
	</Card.Root>
{:else}
	<div class="grid grid-cols-1 gap-8">
		{#each accounts as account}
			{@const Icon = typeIcons[account.type] ?? Wallet}
			{@const chartConfig = {
				balance: { label: 'Balance', color: account.color }
			} satisfies Chart.ChartConfig}
			{@const chartDataParsed = account.chartData.map((d: ChartDataPoint) => ({
				...d,
				date: new Date(d.date)
			}))}
			<Card.Root class="group overflow-hidden border-2 transition-all hover:border-primary/30">
				<Card.Header class="border-b bg-muted/10 pb-6">
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-4">
							<div
								class="rounded-xl p-2.5"
								style="background-color: {account.color}20; color: {account.color}"
							>
								<Icon class="h-6 w-6" />
							</div>
							<div>
								<Card.Title class="text-2xl transition-colors group-hover:text-primary"
									>{account.name}</Card.Title
								>
								<Card.Description class="line-clamp-1"
									>{account.description ?? 'No description'}</Card.Description
								>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<EditAccountDialog {account} />
							<Badge
								variant="secondary"
								class="px-3 py-1 text-xs font-bold tracking-wider uppercase"
							>
								{typeLabels[account.type]}
							</Badge>
						</div>
					</div>
				</Card.Header>
				<Card.Content class="pt-8">
					<div class="mb-8 flex flex-col gap-1">
						<div class="text-sm font-medium tracking-wider text-muted-foreground uppercase">
							Current Balance
						</div>
						<div class="flex items-baseline gap-3">
							<div class="text-5xl font-black tracking-tight">
								{formatAmount(account.currentBalance, account.currencyCode, account.currencySymbol)}
							</div>
							<p
								class="mt-1 flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 text-sm"
							>
								{#if account.currentBalance >= account.initialBalance}
									<ArrowUpRight class="h-4 w-4 text-emerald-500" />
									<span class="font-semibold text-emerald-500">
										+{formatAmount(
											account.currentBalance - account.initialBalance,
											account.currencyCode,
											account.currencySymbol
										)}
									</span>
								{:else}
									<ArrowDownLeft class="h-4 w-4 text-rose-500" />
									<span class="font-semibold text-rose-500">
										-{formatAmount(
											account.initialBalance - account.currentBalance,
											account.currencyCode,
											account.currencySymbol
										)}
									</span>
								{/if}
								<span class="text-xs text-muted-foreground">vs initial</span>
							</p>
						</div>
						<div class="mt-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
							{account.currencyCode} • {account.currencySymbol}
						</div>
					</div>

					<div class="grid grid-cols-[auto_25rem] gap-12 xl:grid-cols-12">
						<!-- Left Column: Chart -->
						<div class="xl:col-span-7">
							<h3
								class="mb-6 flex items-center gap-2 text-sm font-bold tracking-widest text-muted-foreground uppercase"
							>
								<div
									class="h-1.5 w-1.5 rounded-full"
									style="background-color: {account.color}"
								></div>
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
											class: 'opacity-80 hover:opacity-100 transition-opacity'
										},
										xAxis: {
											format: (v: Date) => {
												return v.toLocaleDateString('en-US', {
													day: 'numeric'
												});
											},
											ticks: 10
										},
										yAxis: {
											format: (v: number) =>
												v.toLocaleString('en-US', {
													style: 'currency',
													currency: account.currencyCode,
													maximumFractionDigits: 0
												}),
											ticks: 5
										}
									}}
								>
									{#snippet tooltip()}
										<Chart.Tooltip
											labelFormatter={(v: Date) => {
												return v.toLocaleDateString('en-US', {
													month: 'long',
													day: 'numeric',
													year: 'numeric'
												});
											}}
										/>
									{/snippet}
								</BarChart>
							</ChartContainer>
						</div>

						<!-- Right Column: Transactions -->
						<div class="flex h-full flex-col xl:col-span-5">
							<div class="mb-6 flex items-center justify-between">
								<h3
									class="flex items-center gap-2 text-sm font-bold tracking-widest text-muted-foreground uppercase"
								>
									<TrendingUp class="h-4 w-4" />
									Recent Transactions
								</h3>
							</div>

							<div class="overflow-hidden rounded-xl border bg-card">
								<Table.Root>
									<Table.Header class="bg-muted/30">
										<Table.Row>
											<Table.Head class="text-[10px] font-bold tracking-wider uppercase"
												>Date</Table.Head
											>
											<Table.Head class="text-[10px] font-bold tracking-wider uppercase"
												>Name</Table.Head
											>
											<Table.Head class="text-right text-[10px] font-bold tracking-wider uppercase"
												>Amount</Table.Head
											>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#if account.last10Transactions.length === 0}
											<Table.Row>
												<Table.Cell colspan={3} class="py-12 text-center text-muted-foreground">
													No transactions yet.
												</Table.Cell>
											</Table.Row>
										{:else}
											{#each account.last10Transactions as tx}
												<Table.Row class="group transition-colors">
													<Table.Cell class="py-3 text-xs font-medium text-muted-foreground">
														{formatDate(tx.createdAt)}
													</Table.Cell>
													<Table.Cell class="py-3">
														<div class="flex flex-col">
															<span class="line-clamp-1 text-sm font-semibold"
																>{tx.name ?? tx.payee ?? 'Untitled'}</span
															>
															<span
																class="text-[10px] tracking-tighter text-muted-foreground uppercase"
																>{tx.category ?? 'Uncategorized'}</span
															>
														</div>
													</Table.Cell>
													<Table.Cell class="py-3 text-right font-bold">
														<span
															class={tx.type === 'income' ? 'text-emerald-500' : 'text-foreground'}
														>
															{tx.type === 'income' ? '+' : '-'}{formatAmount(
																tx.amount,
																account.currencyCode,
																account.currencySymbol
															)}
														</span>
													</Table.Cell>
												</Table.Row>
											{/each}
										{/if}
									</Table.Body>
								</Table.Root>
							</div>
							<div class="mt-4 flex justify-end">
								<Button
									variant="ghost"
									size="sm"
									class="gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
								>
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
