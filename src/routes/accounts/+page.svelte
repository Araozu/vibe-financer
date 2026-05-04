<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import CreateAccountDialog from '$lib/components/account/create-account-dialog.svelte';
	import {
		CreditCard,
		TrendingUp,
		TrendingDown,
		Coins,
		Wallet,
		Landmark,
		CircleDollarSign,
		Plus
	} from '@lucide/svelte';
	import type { Account, AccountType } from '$lib/domain/account';

	interface ChartDataPoint {
		date: string;
		balance: number;
	}

	interface DetailedAccount extends Omit<Account, 'createdAt' | 'updatedAt'> {
		createdAt: string;
		updatedAt: string;
		last10Transactions: unknown[];
		chartData: ChartDataPoint[];
	}

	const now = new Date();
	let selectedMonth = $state(now.getUTCMonth());
	let selectedYear = $state(now.getUTCFullYear());

	const accountsQuery = createQuery<DetailedAccount[]>(() => ({
		queryKey: ['accounts', 'detailed', selectedMonth, selectedYear],
		queryFn: async () => {
			const res = await fetch(`/api/accounts/detailed?month=${selectedMonth}&year=${selectedYear}`);
			return res.json();
		}
	}));

	let accounts = $derived(accountsQuery.data ?? []);
	let isLoadingAccounts = $derived(accountsQuery.isPending && accounts.length === 0);

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

	function formatAmount(amount: number, currencySymbol: string) {
		const formatted = (Math.abs(amount) / 100).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		return `${currencySymbol}${formatted}`;
	}

	// Compute summary stats
	let totalBalance = $derived(accounts.reduce((sum, acc) => sum + acc.currentBalance, 0));

	let activeAccountCount = $derived(accounts.length);

	// Monthly change: difference between end-of-month balance and start-of-month balance across all accounts
	let monthlyChange = $derived(
		accounts.reduce((sum, acc) => {
			if (acc.chartData.length >= 2) {
				const startBalance = acc.chartData[0].balance;
				const endBalance = acc.chartData[acc.chartData.length - 1].balance;
				return sum + (endBalance - startBalance);
			}
			return sum;
		}, 0)
	);

	// Monthly change per account as percentage
	function getMonthlyChangePercent(account: DetailedAccount): number | null {
		if (account.chartData.length < 2) return null;
		const startBalance = account.chartData[0].balance;
		const endBalance = account.chartData[account.chartData.length - 1].balance;
		if (startBalance === 0) return null;
		return ((endBalance - startBalance) / Math.abs(startBalance)) * 100;
	}

	// Pick a representative currency symbol for the total (use the most common one)
	let primaryCurrencySymbol = $derived.by(() => {
		if (accounts.length === 0) return '$';
		const symbolCounts = new Map<string, number>();
		for (const acc of accounts) {
			const sym = acc.currencySymbol ?? '$';
			symbolCounts.set(sym, (symbolCounts.get(sym) ?? 0) + 1);
		}
		let maxSym = '$';
		let maxCount = 0;
		for (const [sym, count] of symbolCounts) {
			if (count > maxCount) {
				maxSym = sym;
				maxCount = count;
			}
		}
		return maxSym;
	});
</script>

<!-- Header -->
<div class="mb-8 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-bold">Accounts</h1>
		<p class="text-sm text-muted-foreground">Manage the accounts that track your balances.</p>
	</div>
	<CreateAccountDialog>
		{#snippet trigger()}
			<Button class="gap-2 rounded-full font-semibold">
				<Plus class="h-4 w-4" />
				Add Account
			</Button>
		{/snippet}
	</CreateAccountDialog>
</div>

<!-- Summary Cards -->
{#if isLoadingAccounts}
	<div class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each Array.from({ length: 3 }) as _}
			<Card.Root class="shadow-sm">
				<Card.Content class="space-y-3 p-6">
					<Skeleton class="h-4 w-28" />
					<Skeleton class="h-9 w-40" />
					<Skeleton class="h-4 w-32" />
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{:else if accounts.length > 0}
	<div class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
		<!-- Total Balance -->
		<Card.Root class="overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg">
			<Card.Content class="p-6">
				<p class="text-sm font-medium opacity-90">Total Balance</p>
				<p class="mt-2 text-3xl font-bold tracking-tight">
					{formatAmount(totalBalance, primaryCurrencySymbol)}
				</p>
				<p class="mt-1 text-sm opacity-75">
					Across {activeAccountCount} account{activeAccountCount !== 1 ? 's' : ''}
				</p>
			</Card.Content>
		</Card.Root>

		<!-- Active Accounts -->
		<Card.Root class="shadow-sm">
			<Card.Content class="p-6">
				<p class="text-sm font-medium text-muted-foreground">Active Accounts</p>
				<p class="mt-2 text-3xl font-bold tracking-tight">{activeAccountCount}</p>
				<p class="mt-1 text-sm font-medium text-emerald-500">All in good standing</p>
			</Card.Content>
		</Card.Root>

		<!-- Monthly Change -->
		<Card.Root class="shadow-sm">
			<Card.Content class="p-6">
				<p class="text-sm font-medium text-muted-foreground">Monthly Change</p>
				<p
					class="mt-2 text-3xl font-bold tracking-tight {monthlyChange >= 0
						? 'text-emerald-500'
						: 'text-destructive'}"
				>
					{monthlyChange >= 0 ? '+' : '-'}{formatAmount(
						Math.abs(monthlyChange),
						primaryCurrencySymbol
					)}
				</p>
				<p class="mt-1 text-sm text-muted-foreground">vs. last month</p>
			</Card.Content>
		</Card.Root>
	</div>
{/if}

<!-- Account List -->
{#if isLoadingAccounts}
	<div class="flex flex-col gap-4">
		{#each Array.from({ length: 4 }) as _}
			<Card.Root class="shadow-sm">
				<Card.Content class="p-5">
					<div class="flex items-center justify-between gap-4">
						<div class="flex min-w-0 items-center gap-4">
							<Skeleton class="h-12 w-12 shrink-0 rounded-full" />
							<div class="min-w-0 space-y-2">
								<Skeleton class="h-4 w-36" />
								<Skeleton class="h-3 w-48 max-w-[50vw]" />
							</div>
						</div>
						<div class="flex shrink-0 flex-col items-end gap-2">
							<Skeleton class="h-5 w-24" />
							<Skeleton class="h-3 w-28" />
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{:else if accounts.length === 0}
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
	<div class="flex flex-col gap-4">
		{#each accounts as account (account.id)}
			{@const Icon = typeIcons[account.type] ?? Wallet}
			{@const changePercent = getMonthlyChangePercent(account)}
			<a
				href="/accounts/{account.id}"
				class="block rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<!-- Left: Icon + Info -->
					<div class="flex items-center gap-4">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-full"
							style="background-color: {account.color}15; color: {account.color}"
						>
							<Icon class="h-5 w-5" />
						</div>
						<div>
							<p class="font-semibold">{account.name}</p>
							<p class="text-sm text-muted-foreground">
								{typeLabels[account.type] ?? 'Account'} &bull; {account.currencyCode ?? 'USD'}
							</p>
						</div>
					</div>

					<!-- Right: Balance + Change -->
					<div class="text-right">
						<p class="text-lg font-bold">
							{formatAmount(account.currentBalance, account.currencySymbol ?? '$')}
						</p>
						{#if changePercent !== null}
							<p class="text-sm {changePercent >= 0 ? 'text-emerald-500' : 'text-destructive'}">
								{#if changePercent >= 0}
									<span>&#9650; {changePercent.toFixed(1)}% this month</span>
								{:else}
									<span>&#9660; {Math.abs(changePercent).toFixed(1)}% this month</span>
								{/if}
							</p>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
