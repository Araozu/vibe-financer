<script lang="ts">
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Info,
		MoreVertical,
		Pencil,
		Trash2,
		Tag,
		Utensils,
		Car,
		Home,
		ShoppingBag,
		TrendingUp
	} from '@lucide/svelte';
	import { formatLocalDate, formatLocalDateTime, formatLocalTime } from '$lib/domain/date-formatter';

	export interface Transaction {
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
		deletedAt: string | null;
	}

	export interface Account {
		id: string;
		name: string;
		color: string;
		currencyCode?: string | null;
		currencySymbol?: string | null;
	}

	let { tx, account, deletingTransactionId, onEdit, onDelete, isFuture = false } = $props<{
		tx: Transaction;
		account: Account | null;
		deletingTransactionId: string | null;
		onEdit: (tx: Transaction) => void;
		onDelete: (id: string) => void;
		isFuture?: boolean;
	}>();

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

	const Icon = $derived(getCategoryIcon(tx.category));

	function handleRowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		onEdit(tx);
	}
</script>

<Table.Row
	tabindex={0}
	role="button"
	aria-label={`Edit transaction ${tx.name ?? 'Untitled'}`}
	class="cursor-pointer focus-visible:outline-none focus-visible:[&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/70 {isFuture
		? 'bg-muted/30 opacity-75 [&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/30 hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/50'
		: ''}"
	onclick={() => onEdit(tx)}
	onkeydown={handleRowKeydown}
>
	<Table.Cell>
		<div class="flex items-center gap-3">
			<div class="rounded-full bg-muted p-2">
				<Icon class="h-4 w-4" />
			</div>
			<div>
				<div class="font-medium">{tx.name ?? 'Untitled'}</div>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<div class="text-xs text-muted-foreground">
								{formatLocalDate(tx.createdAt)} · {formatLocalTime(tx.createdAt)}
							</div>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<div class="flex flex-col gap-1 p-1">
								<div
									class="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase"
								>
									<Info class="h-3 w-3" />
									Full Timestamp
								</div>
								<div class="text-xs font-medium">
									{formatLocalDateTime(tx.createdAt)}
								</div>
								<div class="text-[10px] text-muted-foreground/80 italic">
									{new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' })
										.format(new Date(tx.createdAt))
										.split(', ')[1]}
								</div>
							</div>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
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
		<Badge variant="secondary"
			>{tx.category && tx.category.trim() !== '' ? tx.category : 'None'}</Badge
		>
	</Table.Cell>
	<Table.Cell
		class="text-right font-medium {tx.type === 'income'
			? 'text-income'
			: tx.type === 'transfer'
				? 'text-blue-500'
				: 'text-expense'}"
	>
		{tx.type === 'income' ? '+' : tx.type === 'transfer' ? '→' : '-'}{account?.currencySymbol ??
			'$'}{(tx.amount / 100).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		})}
	</Table.Cell>
	<Table.Cell>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger onclick={(event) => event.stopPropagation()}>
				<Button variant="ghost" size="icon" class="h-8 w-8">
					<MoreVertical class="h-4 w-4" />
					<span class="sr-only">Open menu</span>
				</Button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Label>Actions</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={() => onEdit(tx)}>
					<Pencil class="mr-2 h-4 w-4" />
					Edit
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="text-destructive"
					onclick={() => onDelete(tx.id)}
					disabled={deletingTransactionId === tx.id}
				>
					<Trash2 class="mr-2 h-4 w-4" />
					{deletingTransactionId === tx.id ? 'Deleting...' : 'Delete'}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Table.Cell>
</Table.Row>
