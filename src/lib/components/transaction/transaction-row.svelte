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
	import { formatLocalDate, formatLocalDateTime } from '$lib/domain/date-formatter';

	let { tx, account, deletingTransactionId, onEdit, onDelete } = $props<{
		tx: any;
		account: any;
		deletingTransactionId: string | null;
		onEdit: (tx: any) => void;
		onDelete: (id: string) => void;
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
</script>

<Table.Row>
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
								{formatLocalDate(tx.createdAt)}
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
		class="text-right font-medium {tx.type === 'income' ? 'text-income' : 'text-expense'}"
	>
		{tx.type === 'income' ? '+' : '-'}{(tx.amount / 100).toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD'
		})}
	</Table.Cell>
	<Table.Cell>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
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
