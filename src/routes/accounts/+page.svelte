<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import CreateAccountDialog from '$lib/components/account/create-account-dialog.svelte';
	import EditAccountDialog from '$lib/components/account/edit-account-dialog.svelte';
	import CurrencyManagerDialog from '$lib/components/currency/currency-manager-dialog.svelte';
	import BalanceChart from '$lib/components/account/balance-chart.svelte';
	import TransactionRow from '$lib/components/transaction/transaction-row.svelte';
	import {
		CreditCard,
		TrendingUp,
		TrendingDown,
		Coins,
		Wallet,
		ArrowRight,
		Calendar
	} from '@lucide/svelte';
	import EditTransactionDialog from '$lib/components/transaction/edit-transaction-dialog.svelte';
	import type { Account, AccountType } from '$lib/domain/account';
	import type { TransactionType } from '$lib/domain/transaction';

	let editingTransaction = $state<DetailedTransaction | null>(null);

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

	// Month/Year selection
	const now = new Date();
	let selectedMonth = $state(now.getUTCMonth());
	let selectedYear = $state(now.getUTCFullYear());

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

	const years = Array.from({ length: 5 }, (_, i) => now.getUTCFullYear() - 2 + i);

	// Query for detailed accounts
	const accountsQuery = createQuery<DetailedAccount[]>(() => ({
		queryKey: ['accounts', 'detailed', selectedMonth, selectedYear],
		queryFn: async () => {
			const res = await fetch(`/api/accounts/detailed?month=${selectedMonth}&year=${selectedYear}`);
			return res.json();
		}
	}));

	let accounts = $derived(accountsQuery.data ?? []);

	// Also get basic accounts for the transaction dialog
	const basicAccountsQuery = createQuery<SerializedAccount[]>(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json()
	}));

	let _basicAccounts = $derived(basicAccountsQuery.data ?? []);

	const typeIcons: Record<AccountType, typeof CreditCard> = {
		asset: CreditCard,
		expense: TrendingDown,
		revenue: TrendingUp,
		liability: Coins,
		savings: Wallet
	};

	const typeLabels: Record<AccountType, string> = {
		asset: 'Asset',
		expense: 'Expense',
		revenue: 'Revenue',
		liability: 'Liability',
		savings: 'Savings'
	};

	function formatAmount(amount: number, currencySymbol: string) {
		const formatted = (Math.abs(amount) / 100).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		return `${currencySymbol}${formatted}`;
	}
</script>

<div class="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
	<div class="flex items-center gap-3">
		<div class="flex h-10 items-center gap-2 rounded-xl border bg-card px-3 shadow-sm">
			<Calendar class="h-4 w-4 text-muted-foreground" />
			<select
				bind:value={selectedMonth}
				class="bg-transparent text-sm font-bold focus:outline-none"
			>
				{#each months as month, i (i)}
					<option value={i}>{month}</option>
				{/each}
			</select>
			<div class="h-4 w-px bg-border"></div>
			<select bind:value={selectedYear} class="bg-transparent text-sm font-bold focus:outline-none">
				{#each years as year (year)}
					<option value={year}>{year}</option>
				{/each}
			</select>
		</div>

		{#if selectedMonth !== now.getUTCMonth() || selectedYear !== now.getUTCFullYear()}
			<Button
				variant="ghost"
				size="sm"
				onclick={() => {
					selectedMonth = now.getUTCMonth();
					selectedYear = now.getUTCFullYear();
				}}
				class="text-[10px] font-bold tracking-widest uppercase"
			>
				Reset to Today
			</Button>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		<CurrencyManagerDialog />
		<CreateAccountDialog />
	</div>
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
		{#each accounts as account (account.id)}
			{@const Icon = typeIcons[account.type] ?? Wallet}
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
						<div class="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
							Current Balance
						</div>
						<div class="flex items-baseline gap-3">
							<div class="text-6xl font-black tracking-tighter">
								{formatAmount(account.currentBalance, account.currencySymbol ?? '$')}
							</div>
							<p class="mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold">
								{#if account.currentBalance >= account.initialBalance}
									<TrendingUp class="h-3.5 w-3.5 text-emerald-500" />
									<span class="text-emerald-500">
										+{formatAmount(
											account.currentBalance - account.initialBalance,
											account.currencySymbol ?? '$'
										)}
									</span>
								{:else}
									<TrendingDown class="h-3.5 w-3.5 text-rose-500" />
									<span class="text-rose-500">
										-{formatAmount(
											account.initialBalance - account.currentBalance,
											account.currencySymbol ?? '$'
										)}
									</span>
								{/if}
								<span class="ml-1 font-medium text-muted-foreground/60 lowercase">vs initial</span>
							</p>
						</div>
						<div
							class="mt-1 text-[10px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase"
						>
							{account.currencyCode ?? 'USD'} • {account.currencySymbol ?? '$'}
						</div>
					</div>

					<div class="grid grid-cols-1 gap-12">
						<!-- Top: Chart -->
						<div class="w-full">
							<h3
								class="mb-6 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase"
							>
								<div class="h-1 w-3 rounded-full" style="background-color: {account.color}"></div>
								Balance History ({months[selectedMonth]}
								{selectedYear})
							</h3>
							<BalanceChart
								data={account.chartData}
								color={account.color}
								currencySymbol={account.currencySymbol ?? '$'}
								currencyCode={account.currencyCode ?? 'USD'}
							/>
						</div>

						<!-- Bottom: Transactions -->
						<div class="flex flex-col">
							<div class="mb-6 flex items-center justify-between">
								<h3
									class="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase"
								>
									<TrendingUp class="h-3.5 w-3.5" />
									Recent Transactions
								</h3>
							</div>

							<div class="overflow-hidden rounded-xl border-none bg-card/50">
								<Table.Root>
									<Table.Header class="bg-transparent">
										<Table.Row class="hover:bg-transparent">
											<Table.Head class="h-8 text-[9px] font-bold tracking-widest uppercase"
												>Date</Table.Head
											>
											<Table.Head class="h-8 text-[9px] font-bold tracking-widest uppercase"
												>Name</Table.Head
											>
											<Table.Head
												class="h-8 text-right text-[9px] font-bold tracking-widest uppercase"
											></Table.Head>
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
											{#each account.last10Transactions as tx (tx.id)}
												<TransactionRow
													{tx}
													{account}
													{deletingTransactionId}
													onEdit={openEditDialog}
													onDelete={handleDeleteTransaction}
												/>
											{/each}
										{/if}
									</Table.Body>
								</Table.Root>
							</div>
							<div class="mt-4 flex justify-end">
								<Button
									variant="ghost"
									size="sm"
									href="/accounts/{account.id}"
									class="gap-1 text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase hover:bg-transparent hover:text-primary"
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

<!-- Edit Transaction Dialog -->
{#if editingTransaction}
	<EditTransactionDialog
		transaction={{
			...editingTransaction,
			createdAt: new Date(editingTransaction.createdAt),
			updatedAt: new Date(editingTransaction.updatedAt),
			deletedAt: null
		}}
		_accounts={_basicAccounts}
		bind:open={editDialogOpen}
	/>
{/if}
