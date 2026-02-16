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
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Loader2
	} from '@lucide/svelte';
	import type { AccountType } from '$lib/domain/account';
	import type { TransactionType } from '$lib/domain/transaction';

	let { data } = $props();
	const account = $derived(data.account);

	let offset = $state(0);
	const limit = 50;

	const transactionsQuery = createQuery(() => ({
		queryKey: ['accounts', account.id, 'transactions', offset],
		queryFn: async () => {
			const res = await fetch(`/api/accounts/${account.id}/transactions?limit=${limit}&offset=${offset}`);
			return res.json();
		},
		placeholderData: (previousData) => previousData
	}));

	let transactions = $derived(transactionsQuery.data?.transactions ?? (offset === 0 ? data.initialTransactions : []));
	let hasMore = $derived(transactionsQuery.data?.hasMore ?? true);

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

	function formatAmount(amount: number, currencySymbol: string) {
		const formatted = (Math.abs(amount) / 100).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		return `${currencySymbol}${formatted}`;
	}

	function formatDate(date: string | Date) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function nextPage() {
		if (hasMore) offset += limit;
	}

	function prevPage() {
		if (offset >= limit) offset -= limit;
	}
</script>

<div class="container mx-auto max-w-5xl py-8">
	<div class="mb-8">
		<Button variant="ghost" href="/accounts" class="mb-4 gap-2 text-muted-foreground hover:text-primary">
			<ArrowLeft class="h-4 w-4" />
			Back to Accounts
		</Button>

		<div class="flex items-center justify-between">
			<div class="flex items-center gap-6">
				<div
					class="rounded-2xl p-4 shadow-lg"
					style="background-color: {account.color}20; color: {account.color}"
				>
					{#if typeIcons[account.type as AccountType]}
						{@const Icon = typeIcons[account.type as AccountType]}
						<Icon class="h-10 w-10" />
					{:else}
						<Wallet class="h-10 w-10" />
					{/if}
				</div>
				<div>
					<div class="flex items-center gap-3">
						<h1 class="text-4xl font-black tracking-tighter">{account.name}</h1>
						<Badge variant="secondary" class="px-3 py-1 text-xs font-bold tracking-widest uppercase">
							{typeLabels[account.type as AccountType]}
						</Badge>
					</div>
					<p class="mt-1 text-muted-foreground">{account.description ?? 'No description'}</p>
				</div>
			</div>

			<div class="text-right">
				<p class="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Current Balance</p>
				<p class="text-5xl font-black tracking-tighter">
					{formatAmount(account.currentBalance, account.currencySymbol)}
				</p>
				<p class="text-[10px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">
					{account.currencyCode} • {account.currencySymbol}
				</p>
			</div>
		</div>
	</div>

	<Card.Root class="border-none bg-card/50 shadow-xl">
		<Card.Header class="flex flex-row items-center justify-between border-b border-border/40 pb-6">
			<div>
				<Card.Title class="text-xl font-bold tracking-tight">Transactions</Card.Title>
				<Card.Description>All historical records for this account</Card.Description>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={prevPage}
					disabled={offset === 0 || transactionsQuery.isPending}
					class="h-8 w-8 p-0"
				>
					<ChevronLeft class="h-4 w-4" />
				</Button>
				<div class="text-xs font-bold tracking-widest text-muted-foreground uppercase">
					Page {offset / limit + 1}
				</div>
				<Button
					variant="outline"
					size="sm"
					onclick={nextPage}
					disabled={!hasMore || transactionsQuery.isPending}
					class="h-8 w-8 p-0"
				>
					<ChevronRight class="h-4 w-4" />
				</Button>
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
							<Table.Head class="h-10 text-[10px] font-bold tracking-widest uppercase pl-6">Date</Table.Head>
							<Table.Head class="h-10 text-[10px] font-bold tracking-widest uppercase">Name</Table.Head>
							<Table.Head class="h-10 text-[10px] font-bold tracking-widest uppercase">Category</Table.Head>
							<Table.Head class="h-10 text-right text-[10px] font-bold tracking-widest uppercase pr-6">Amount</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if transactions.length === 0}
							<Table.Row>
								<Table.Cell colspan={4} class="py-24 text-center text-muted-foreground">
									No transactions found for this period.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each transactions as tx}
								<Table.Row class="group border-b border-border/40 transition-colors hover:bg-muted/20">
									<Table.Cell class="py-4 pl-6 text-xs font-medium text-muted-foreground/70">
										{formatDate(tx.createdAt)}
									</Table.Cell>
									<Table.Cell class="py-4">
										<span class="text-sm font-bold tracking-tight">{tx.name || tx.payee || 'Untitled'}</span>
									</Table.Cell>
									<Table.Cell class="py-4">
										<Badge variant="outline" class="text-[10px] font-bold tracking-widest uppercase">
											{tx.category || 'Uncategorized'}
										</Badge>
									</Table.Cell>
									<Table.Cell class="py-4 text-right pr-6 font-black">
										<span class={tx.type === 'income' ? 'text-emerald-500' : 'text-foreground'}>
											{tx.type === 'income' ? '+' : ''}{formatAmount(tx.amount, account.currencySymbol)}
										</span>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
