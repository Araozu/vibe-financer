<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		CreditCard,
		TrendingUp,
		TrendingDown,
		Coins,
		Wallet,
		Landmark,
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Loader2,
		Pencil,
		Trash2,
		LayoutGrid
	} from '@lucide/svelte';
	import { useQueryClient } from '@tanstack/svelte-query';
	import TransactionRow from '$lib/components/transaction/transaction-row.svelte';
	import EditTransactionDialog from '$lib/components/transaction/edit-transaction-dialog.svelte';
	import EditAccountDialog from '$lib/components/account/edit-account-dialog.svelte';
	import BalanceChart from '$lib/components/account/balance-chart.svelte';
	import type { AccountType } from '$lib/domain/account';
	import { goto } from '$app/navigation';

	const queryClient = useQueryClient();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let editingTransaction = $state<any | null>(null);
	let editDialogOpen = $state(false);
	let deletingTransactionId = $state<string | null>(null);
	let isDeleting = $state(false);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function openEditDialog(tx: any) {
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

			await queryClient.invalidateQueries({ queryKey: ['accounts', account.id] });
		} catch (error) {
			console.error('Error deleting transaction:', error);
			alert(error instanceof Error ? error.message : 'Failed to delete transaction');
		} finally {
			deletingTransactionId = null;
		}
	}

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

	let offset = $state(0);
	const limit = 50;

	// Transaction filter: 'all' | 'income' | 'expense'
	let txFilter = $state<'all' | 'income' | 'expense'>('all');

	const transactionsQuery = createQuery(() => ({
		queryKey: ['accounts', account.id, 'transactions', offset],
		queryFn: async () => {
			const res = await fetch(
				`/api/accounts/${account.id}/transactions?limit=${limit}&offset=${offset}`
			);
			return res.json();
		},
		placeholderData: (previousData: unknown) => previousData
	}));

	let allTransactions = $derived(
		transactionsQuery.data?.transactions ?? (offset === 0 ? data.initialTransactions : [])
	);
	let hasMore = $derived(transactionsQuery.data?.hasMore ?? true);

	// Filtered transactions based on the selected tab
	let transactions = $derived(
		txFilter === 'all'
			? allTransactions
			: // eslint-disable-next-line @typescript-eslint/no-explicit-any
				allTransactions.filter((tx: any) => tx.type === txFilter)
	);

	// Chart data query
	const now = new Date();
	let chartMonth = $derived.by(() => {
		// For 1M, use current month
		return now.getUTCMonth();
	});
	let chartYear = $derived.by(() => {
		return now.getUTCFullYear();
	});

	const chartQuery = createQuery(() => ({
		queryKey: ['accounts', 'detailed', chartMonth, chartYear],
		queryFn: async () => {
			const res = await fetch(`/api/accounts/detailed?month=${chartMonth}&year=${chartYear}`);
			return res.json();
		}
	}));

	 
	let chartData = $derived.by(() => {
		const accounts = chartQuery.data ?? [];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const thisAccount = accounts.find((a: any) => a.id === account.id);
		if (!thisAccount?.chartData) return [];
		return thisAccount.chartData;
	});

	// Compute monthly income/expenses from transaction data
	let monthlyIncome = $derived(
		 
		allTransactions
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.filter((tx: any) => tx.type === 'income')
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.reduce((sum: number, tx: any) => sum + tx.amount, 0)
	);

	let monthlyExpenses = $derived(
		 
		allTransactions
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.filter((tx: any) => tx.type === 'expense')
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.reduce((sum: number, tx: any) => sum + tx.amount, 0)
	);

	let monthlyNet = $derived(monthlyIncome - monthlyExpenses);
	let totalTransactionCount = $derived(allTransactions.length);

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

	function nextPage() {
		if (hasMore) offset += limit;
	}

	function prevPage() {
		if (offset >= limit) offset -= limit;
	}

	const Icon = $derived(typeIcons[account.type as AccountType] ?? Wallet);

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
				{formatAmount(account.currentBalance, account.currencySymbol ?? '$')}
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
<Card.Root class="mb-8 shadow-sm">
	<Card.Content class="p-6">
		<div class="mb-4">
			<h2 class="text-lg font-bold">Balance History</h2>
			<p class="text-sm text-muted-foreground">
				Daily end-of-day balance for {months[now.getUTCMonth()]}
				{now.getUTCFullYear()}
			</p>
		</div>
		{#if chartData.length > 0}
			<BalanceChart
				data={chartData}
				color={account.color}
				currencySymbol={account.currencySymbol ?? '$'}
			/>
		{:else}
			<div class="flex h-[280px] items-center justify-center text-muted-foreground">
				<p>No chart data available</p>
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<!-- Transactions Section -->
<Card.Root class="shadow-sm">
	<Card.Header class="flex flex-row items-center justify-between border-b border-border/40 pb-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-bold">Transactions</h2>
			<Badge variant="secondary" class="rounded-full px-2.5 py-0.5 text-xs font-semibold">
				{totalTransactionCount}
			</Badge>
		</div>
		<div
			class="flex items-center gap-1 overflow-hidden rounded-lg border border-border/40 bg-muted/30"
		>
			<button
				class="px-3 py-1.5 text-xs font-medium transition-all
					{txFilter === 'all'
					? 'bg-foreground text-background shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => {
					txFilter = 'all';
				}}
			>
				All
			</button>
			<button
				class="px-3 py-1.5 text-xs font-medium transition-all
					{txFilter === 'income'
					? 'bg-foreground text-background shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => {
					txFilter = 'income';
				}}
			>
				Income
			</button>
			<button
				class="px-3 py-1.5 text-xs font-medium transition-all
					{txFilter === 'expense'
					? 'bg-foreground text-background shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => {
					txFilter = 'expense';
				}}
			>
				Expenses
			</button>
		</div>
	</Card.Header>
	<Card.Content class="p-0">
		{#if transactionsQuery.isPending && transactions.length === 0}
			<div class="flex h-64 items-center justify-center">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground/40" />
			</div>
		{:else}
			<Table.Root>
				<Table.Header class="bg-muted/30">
					<Table.Row class="hover:bg-transparent">
						<Table.Head class="h-10 pl-6 text-[10px] font-bold tracking-widest uppercase"
							>Transaction</Table.Head
						>
						<Table.Head
							class="hidden h-10 text-[10px] font-bold tracking-widest uppercase md:table-cell"
							>Account</Table.Head
						>
						<Table.Head
							class="hidden h-10 text-[10px] font-bold tracking-widest uppercase md:table-cell"
							>Category</Table.Head
						>
						<Table.Head class="h-10 pr-6 text-right text-[10px] font-bold tracking-widest uppercase"
							>Amount</Table.Head
						>
						<Table.Head class="h-10 w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if transactions.length === 0}
						<Table.Row>
							<Table.Cell colspan={5} class="py-24 text-center text-muted-foreground">
								No transactions found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each transactions as tx (tx.id)}
							<TransactionRow
								tx={{
									...tx,
									createdAt:
										tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
									updatedAt:
										tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : tx.updatedAt,
									deletedAt:
										tx.deletedAt instanceof Date
											? tx.deletedAt.toISOString()
											: (tx.deletedAt ?? null)
								}}
								{account}
								{deletingTransactionId}
								onEdit={openEditDialog}
								onDelete={handleDeleteTransaction}
							/>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		{/if}
	</Card.Content>

	<!-- Pagination -->
	{#if allTransactions.length > 0}
		<div class="flex items-center justify-between border-t border-border/40 px-6 py-3">
			<p class="text-xs text-muted-foreground">
				Showing {offset + 1}–{offset + allTransactions.length} transactions
			</p>
			<div class="flex items-center gap-2">
				<button
					class="{skeuBtn} flex h-8 w-8 items-center justify-center disabled:opacity-40"
					onclick={prevPage}
					disabled={offset === 0 || transactionsQuery.isPending}
				>
					<ChevronLeft class="h-4 w-4" />
				</button>
				<span class="text-xs font-medium text-muted-foreground">
					Page {offset / limit + 1}
				</span>
				<button
					class="{skeuBtn} flex h-8 w-8 items-center justify-center disabled:opacity-40"
					onclick={nextPage}
					disabled={!hasMore || transactionsQuery.isPending}
				>
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/if}
</Card.Root>

<!-- Edit Transaction Dialog -->
{#if editingTransaction}
	<EditTransactionDialog
		transaction={{
			...editingTransaction,
			createdAt: new Date(editingTransaction.createdAt),
			updatedAt: new Date(editingTransaction.updatedAt),
			deletedAt: null
		}}
		_accounts={[account]}
		bind:open={editDialogOpen}
	/>
{/if}
