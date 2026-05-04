<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import RangeCalendar from '$lib/components/ui/range-calendar/range-calendar.svelte';
	import {
		CalendarDays,
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		Loader2,
		Wallet,
		Search,
		X
	} from '@lucide/svelte';
	import TransactionRow from '$lib/components/transaction/transaction-row.svelte';
	import EditTransactionDialog from '$lib/components/transaction/edit-transaction-dialog.svelte';
	import { toast } from 'svelte-sonner';
	import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';

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
	type DatePresetValue =
		| 'all'
		| '7d'
		| '30d'
		| '90d'
		| 'this-month'
		| 'last-month'
		| 'this-year'
		| 'custom';

	const queryClient = useQueryClient();
	const limit = 50;
	const localTimeZone = getLocalTimeZone();

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
		showAccountFilter = true,
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
			startDate: string;
			endDate: string;
			category: string;
			accountId: string;
		}) => Promise<TransactionPage>;
		invalidateQueryKeys?: unknown[][];
		showTypeFilter?: boolean;
		showTimeframeFilter?: boolean;
		showCategoryFilter?: boolean;
		showAccountFilter?: boolean;
		emptyMessage?: string;
		filteredEmptyMessage?: string;
	} = $props();

	let offset = $state(0);
	let txFilter = $state<TransactionTypeFilter>('all');
	let searchQuery = $state('');
	let debouncedSearch = $state('');
	let datePopoverOpen = $state(false);
	let selectedDateRange = $state<DateRange | undefined>();
	let selectedDatePreset = $state<DatePresetValue>('all');
	let selectedCategory = $state('');
	let selectedAccountId = $state('');
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

	const datePresets: { value: Exclude<DatePresetValue, 'custom'>; label: string }[] = [
		{ value: 'all', label: 'All time' },
		{ value: '7d', label: 'Last 7 days' },
		{ value: '30d', label: 'Last 30 days' },
		{ value: '90d', label: 'Last 90 days' },
		{ value: 'this-month', label: 'This month' },
		{ value: 'last-month', label: 'Last month' },
		{ value: 'this-year', label: 'This year' }
	];

	const activeTypeFilter = $derived(showTypeFilter ? txFilter : 'all');
	const activeStartDate = $derived(
		showTimeframeFilter ? (selectedDateRange?.start?.toString() ?? '') : ''
	);
	const activeEndDate = $derived(
		showTimeframeFilter ? (selectedDateRange?.end?.toString() ?? '') : ''
	);
	const activeCategory = $derived(showCategoryFilter ? selectedCategory : '');
	const activeAccountId = $derived(showAccountFilter ? selectedAccountId : '');
	const filtersKey = $derived(
		[
			activeTypeFilter,
			activeStartDate,
			activeEndDate,
			activeCategory,
			activeAccountId,
			debouncedSearch
		].join('::')
	);
	const hasActiveFilters = $derived(
		searchQuery.trim().length > 0 ||
			(showTimeframeFilter && (activeStartDate !== '' || activeEndDate !== '')) ||
			(showCategoryFilter && selectedCategory !== '') ||
			(showAccountFilter && selectedAccountId !== '') ||
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
			activeStartDate,
			activeEndDate,
			activeCategory,
			activeAccountId,
			debouncedSearch
		],
		queryFn: () =>
			fetchPage({
				limit,
				offset,
				search: debouncedSearch,
				type: activeTypeFilter,
				startDate: activeStartDate,
				endDate: activeEndDate,
				category: activeCategory,
				accountId: activeAccountId
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
		selectedDateRange = undefined;
		selectedDatePreset = 'all';
		selectedCategory = '';
		selectedAccountId = '';
		txFilter = 'all';
	}

	function formatCalendarDate(date: DateRange['start']) {
		return date?.toDate(localTimeZone).toLocaleDateString() ?? '';
	}

	function getDateFilterLabel() {
		if (!selectedDateRange?.start && !selectedDateRange?.end) return 'All time';
		if (selectedDateRange.start && selectedDateRange.end) {
			return `${formatCalendarDate(selectedDateRange.start)} - ${formatCalendarDate(selectedDateRange.end)}`;
		}

		return selectedDateRange.start
			? `From ${formatCalendarDate(selectedDateRange.start)}`
			: `Until ${formatCalendarDate(selectedDateRange.end)}`;
	}

	function getLastMonthRange(todayDate: CalendarDate) {
		const month = todayDate.month === 1 ? 12 : todayDate.month - 1;
		const year = todayDate.month === 1 ? todayDate.year - 1 : todayDate.year;
		const start = new CalendarDate(year, month, 1);

		return {
			start,
			end: start.add({ months: 1, days: -1 })
		};
	}

	function getPresetDateRange(preset: DatePresetValue): DateRange | undefined {
		const todayDate = today(localTimeZone);

		switch (preset) {
			case '7d':
				return { start: todayDate.add({ days: -6 }), end: todayDate };
			case '30d':
				return { start: todayDate.add({ days: -29 }), end: todayDate };
			case '90d':
				return { start: todayDate.add({ days: -89 }), end: todayDate };
			case 'this-month':
				return { start: new CalendarDate(todayDate.year, todayDate.month, 1), end: todayDate };
			case 'last-month':
				return getLastMonthRange(todayDate);
			case 'this-year':
				return { start: new CalendarDate(todayDate.year, 1, 1), end: todayDate };
			default:
				return undefined;
		}
	}

	function selectDatePreset(preset: DatePresetValue) {
		selectedDatePreset = preset;
		selectedDateRange = getPresetDateRange(preset);
		if (preset === 'all') {
			datePopoverOpen = false;
		}
	}

	$effect(() => {
		if (!selectedDateRange?.start && !selectedDateRange?.end) {
			selectedDatePreset = 'all';
			return;
		}

		const matchingPreset = datePresets.find((preset) => {
			const presetRange = getPresetDateRange(preset.value);
			return (
				presetRange?.start?.toString() === selectedDateRange?.start?.toString() &&
				presetRange?.end?.toString() === selectedDateRange?.end?.toString()
			);
		});

		selectedDatePreset = matchingPreset?.value ?? 'custom';
	});

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

			{#if showTimeframeFilter || showCategoryFilter || showAccountFilter}
				<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
					{#if showTimeframeFilter}
						<Popover.Root bind:open={datePopoverOpen}>
							<Popover.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										class="w-full justify-between font-normal sm:w-[260px]"
									>
										<span class="flex min-w-0 items-center gap-2">
											<CalendarDays class="h-4 w-4 shrink-0 text-muted-foreground" />
											<span class="truncate">{getDateFilterLabel()}</span>
										</span>
										<ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" />
									</Button>
								{/snippet}
							</Popover.Trigger>
							<Popover.Content class="w-auto overflow-hidden p-0" align="start">
								<div class="flex flex-col">
									<RangeCalendar
										bind:value={selectedDateRange}
										captionLayout="dropdown"
										numberOfMonths={2}
										pagedNavigation
										class="bg-transparent"
									/>
									<div class="grid grid-cols-2 gap-2 border-t p-3 sm:grid-cols-4">
										{#each datePresets as preset (preset.value)}
											<Button
												type="button"
												variant={selectedDatePreset === preset.value ? 'default' : 'outline'}
												size="sm"
												class="justify-center"
												onclick={() => selectDatePreset(preset.value)}
											>
												{preset.label}
											</Button>
										{/each}
									</div>
								</div>
							</Popover.Content>
						</Popover.Root>
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

					{#if showAccountFilter}
						<Select.Root type="single" bind:value={selectedAccountId}>
							<Select.Trigger class="w-full sm:w-[190px]">
								{#if selectedAccountId}
									{@const selectedAccount = accountById.get(selectedAccountId)}
									<span class="flex min-w-0 items-center gap-2">
										<span
											class="h-2.5 w-2.5 shrink-0 rounded-full"
											style="background-color: {selectedAccount?.color ??
												'var(--muted-foreground)'}"
										></span>
										<span class="truncate">{selectedAccount?.name ?? 'Account'}</span>
									</span>
								{:else}
									<span class="flex min-w-0 items-center gap-2">
										<Wallet class="h-4 w-4 shrink-0 text-muted-foreground" />
										<span class="truncate">All accounts</span>
									</span>
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="" label="All accounts">
									<span class="flex items-center gap-2">
										<Wallet class="h-4 w-4 text-muted-foreground" />
										All accounts
									</span>
								</Select.Item>
								{#each accounts as account (account.id)}
									<Select.Item value={account.id} label={account.name}>
										<span class="flex items-center gap-2">
											<span
												class="h-2.5 w-2.5 rounded-full"
												style="background-color: {account.color}"
											></span>
											{account.name}
										</span>
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
