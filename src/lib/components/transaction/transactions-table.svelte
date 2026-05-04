<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ChevronLeft, ChevronRight, Loader2, Search, X } from '@lucide/svelte';
	import TransactionRow from '$lib/components/transaction/transaction-row.svelte';
	import EditTransactionDialog from '$lib/components/transaction/edit-transaction-dialog.svelte';
	import type { TransactionTimeframe } from '$lib/application/transaction/list-transactions';
	import { toast } from 'svelte-sonner';

	export type SerializedTransaction = {
		id: string;
		accountId: string;
		type: 'expense' | 'income' | 'transfer';
		amount: number;
		name: string | null;
		description: string | null;
		category: string | null;
		budgetId: string | null;
		payee: string | null;
		toAccountId: string | null;
		createdAt: string;
		updatedAt: string;
		deletedAt?: string | null;
	};

	export type TransactionTableAccount = {
		id: string;
		name: string;
		color: string;
		currencyId: string;
		currencyCode?: string | null;
		currencySymbol?: string | null;
	};

	export type TransactionPage = {
		transactions: SerializedTransaction[];
		hasMore: boolean;
	};

	type TransactionTypeFilter = 'all' | 'income' | 'expense' | 'transfer';

	const queryClient = useQueryClient();
	const limit = 50;

	let {
		title = 'Transactions',
		initialTransactions,
		accounts,
		categories = [],
		queryKeyBase,
		fetchPage,
		invalidateQueryKeys = [],
		showTypeFilter = true,
		showTimeframeFilter = true,
		showCategoryFilter = true,
		emptyMessage = 'No transactions found.',
		filteredEmptyMessage = 'No transactions match the current filters.'
	}: {
		title?: string;
		initialTransactions: SerializedTransaction[];
		accounts: TransactionTableAccount[];
		categories?: string[];
		queryKeyBase: unknown[];
		fetchPage: (params: {
			limit: number;
			offset: number;
			search: string;
			type: TransactionTypeFilter;
			timeframe: TransactionTimeframe;
			category: string;
		}) => Promise<TransactionPage>;
		invalidateQueryKeys?: unknown[][];
		showTypeFilter?: boolean;
		showTimeframeFilter?: boolean;
		showCategoryFilter?: boolean;
		emptyMessage?: string;
		filteredEmptyMessage?: string;
	} = $props();

	let offset = $state(0);
	let txFilter = $state<TransactionTypeFilter>('all');
	let searchQuery = $state('');
	let debouncedSearch = $state('');
	let selectedTimeframe = $state<TransactionTimeframe>('all');
	let selectedCategory = $state('');
	let deletingTransactionId = $state<string | null>(null);
	let editingTransaction = $state<SerializedTransaction | null>(null);
	let editDialogOpen = $state(false);
	let wasEditDialogOpen = $state(false);

	$effect(() => {
		const value = searchQuery;
		const timer = setTimeout(() => {
			debouncedSearch = value;
		}, 350);

		return () => clearTimeout(timer);
	});

	const timeframeOptions: { value: TransactionTimeframe; label: string }[] = [
		{ value: 'all', label: 'All time' },
		{ value: '7d', label: 'Last 7 days' },
		{ value: '30d', label: 'Last 30 days' },
		{ value: '90d', label: 'Last 90 days' },
		{ value: 'this-month', label: 'This month' },
		{ value: 'last-month', label: 'Last month' },
		{ value: 'this-year', label: 'This year' }
	];

	const activeTypeFilter = $derived(showTypeFilter ? txFilter : 'all');
	const activeTimeframe = $derived(showTimeframeFilter ? selectedTimeframe : 'all');
	const activeCategory = $derived(showCategoryFilter ? selectedCategory : '');
	const filtersKey = $derived(
		[activeTypeFilter, activeTimeframe, activeCategory, debouncedSearch].join('::')
	);
	const hasActiveFilters = $derived(
		searchQuery.trim().length > 0 ||
			(showTimeframeFilter && selectedTimeframe !== 'all') ||
			(showCategoryFilter && selectedCategory !== '') ||
			(showTypeFilter && txFilter !== 'all')
	);
	let previousFiltersKey = $state('');

	$effect(() => {
		if (previousFiltersKey !== '' && previousFiltersKey !== filtersKey) {
			offset = 0;
		}

		previousFiltersKey = filtersKey;
	});

	const transactionsQuery = createQuery(() => ({
		queryKey: [
			...queryKeyBase,
			'transactions',
			offset,
			activeTypeFilter,
			activeTimeframe,
			activeCategory,
			debouncedSearch
		],
		queryFn: () =>
			fetchPage({
				limit,
				offset,
				search: debouncedSearch,
				type: activeTypeFilter,
				timeframe: activeTimeframe,
				category: activeCategory
			}),
		placeholderData: (previousData: TransactionPage | undefined) => previousData
	}));

	const transactions = $derived(
		!hasActiveFilters && offset === 0
			? initialTransactions
			: (transactionsQuery.data?.transactions ?? [])
	);
	const hasMore = $derived(transactionsQuery.data?.hasMore ?? transactions.length === limit);
	const accountById = $derived(new Map(accounts.map((account) => [account.id, account])));

	function nextPage() {
		if (hasMore) offset += limit;
	}

	function prevPage() {
		if (offset >= limit) offset -= limit;
	}

	function clearFilters() {
		searchQuery = '';
		selectedTimeframe = 'all';
		selectedCategory = '';
		txFilter = 'all';
	}

	function openEditDialog(tx: SerializedTransaction) {
		editingTransaction = tx;
		editDialogOpen = true;
	}

	async function invalidateRelatedQueries() {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeyBase }),
			queryClient.invalidateQueries({ queryKey: ['budgets'] }),
			...invalidateQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
		]);
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

			await invalidateRelatedQueries();
			toast.success('Transaction deleted');
		} catch (error) {
			console.error('Error deleting transaction:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to delete transaction');
		} finally {
			deletingTransactionId = null;
		}
	}

	$effect(() => {
		if (wasEditDialogOpen && !editDialogOpen) {
			void invalidateRelatedQueries();
		}
		wasEditDialogOpen = editDialogOpen;
	});

	const skeuBtn =
		'rounded-md border border-border/40 bg-linear-to-b from-background to-accent/10 shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(0,0,0,0.1)] transition-all hover:to-accent/20 active:translate-y-px active:shadow-inner dark:from-muted/15 dark:to-muted/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_1.5px_3px_rgba(0,0,0,0.3)] dark:hover:to-muted/10';
</script>

<Card.Root class="shadow-sm">
	<Card.Header class="flex flex-row items-center justify-between border-b border-border/40 pb-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-bold">{title}</h2>
			<Badge variant="secondary" class="rounded-full px-2.5 py-0.5 text-xs font-semibold">
				{transactions.length}
			</Badge>
		</div>
		{#if hasActiveFilters}
			<Button variant="ghost" size="sm" class="h-9 gap-1.5 px-2.5 text-xs" onclick={clearFilters}>
				<X class="h-3.5 w-3.5" />
				Clear
			</Button>
		{/if}
	</Card.Header>
	<Card.Content class="space-y-4 p-6 pb-0">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="relative w-full lg:max-w-sm">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					placeholder="Search transactions"
					class="pl-9"
					bind:value={searchQuery}
				/>
			</div>

			{#if showTimeframeFilter || showCategoryFilter}
				<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
					{#if showTimeframeFilter}
						<Select.Root type="single" bind:value={selectedTimeframe}>
							<Select.Trigger class="w-full sm:w-[170px]">
								{timeframeOptions.find((option) => option.value === selectedTimeframe)?.label ??
									'All time'}
							</Select.Trigger>
							<Select.Content>
								{#each timeframeOptions as option (option.value)}
									<Select.Item value={option.value} label={option.label}>
										{option.label}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{/if}

					{#if showCategoryFilter}
						<Select.Root type="single" bind:value={selectedCategory}>
							<Select.Trigger class="w-full sm:w-[170px]">
								{selectedCategory || 'All categories'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="" label="All categories">All categories</Select.Item>
								{#each categories as category (category)}
									<Select.Item value={category} label={category}>
										{category}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{/if}
				</div>
			{/if}
		</div>

		{#if showTypeFilter}
			<div
				class="flex flex-wrap items-center gap-1 overflow-hidden rounded-lg border border-border/40 bg-muted/30"
			>
				{#each ['all', 'income', 'expense', 'transfer'] as filter (filter)}
					<button
						class="px-3 py-1.5 text-xs font-medium capitalize transition-all
							{txFilter === filter
							? 'bg-foreground text-background shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => {
							txFilter = filter as TransactionTypeFilter;
						}}
					>
						{filter === 'all' ? 'All' : filter}
					</button>
				{/each}
			</div>
		{/if}

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
								{hasActiveFilters ? filteredEmptyMessage : emptyMessage}
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each transactions as tx (tx.id)}
							<TransactionRow
								tx={{ ...tx, deletedAt: tx.deletedAt ?? null }}
								account={accountById.get(tx.accountId) ?? accounts[0] ?? null}
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

	{#if transactions.length > 0}
		<div class="flex items-center justify-between border-t border-border/40 px-6 py-3">
			<p class="text-xs text-muted-foreground">
				Showing {offset + 1}-{offset + transactions.length} transactions
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
