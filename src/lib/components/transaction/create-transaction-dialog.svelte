<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Plus } from '@lucide/svelte';
	import CreateTransactionForm from './create-transaction-form.svelte';
	import EditTransactionDialog from './edit-transaction-dialog.svelte';
	import { cn } from '$lib/utils.js';
	import type { Transaction } from '$lib/domain/transaction';
	import type { Snippet } from 'svelte';

	// Minimal account type for what this component needs
	interface AccountLike {
		id: string;
		name: string;
		color: string;
		currencyId: string;
		currencyCode: string;
	}

	let {
		open = $bindable(false),
		accounts = [],
		trigger
	} = $props<{
		open?: boolean;
		accounts: AccountLike[];
		trigger?: Snippet;
	}>();

	const hasAccounts = $derived(accounts.length > 0);

	let editingTransaction = $state<Transaction | null>(null);
	let editOpen = $state(false);

	function handleSuccess(createMore: boolean) {
		if (!createMore) {
			open = false;
		}
	}

	function handleEdit(tx: Transaction) {
		editingTransaction = {
			...tx,
			createdAt: tx.createdAt instanceof Date ? tx.createdAt : new Date(tx.createdAt),
			updatedAt: tx.updatedAt instanceof Date ? tx.updatedAt : new Date(tx.updatedAt),
			deletedAt: tx.deletedAt
				? tx.deletedAt instanceof Date
					? tx.deletedAt
					: new Date(tx.deletedAt)
				: null
		};
		editOpen = true;
	}
</script>

<Dialog.Root bind:open>
	{#if hasAccounts}
		{#if trigger}
			<Dialog.Trigger>
				{@render trigger()}
			</Dialog.Trigger>
		{:else}
			<Dialog.Trigger class={cn(buttonVariants({ size: 'sm' }))}>
				<Plus class="mr-2 h-4 w-4" />
				Add Transaction
			</Dialog.Trigger>
		{/if}
	{:else}
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger class={cn(buttonVariants({ size: 'sm' }))} disabled>
					{#if trigger}
						{@render trigger()}
					{:else}
						<Plus class="mr-2 h-4 w-4" />
						Add Transaction
					{/if}
				</Tooltip.Trigger>
				<Tooltip.Content>
					<p>You need to create an account first</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/if}
	<Dialog.Content class="overflow-hidden p-0 shadow-2xl sm:max-w-2xl">
		<CreateTransactionForm {accounts} onSuccess={handleSuccess} onEdit={handleEdit} />
	</Dialog.Content>
</Dialog.Root>

{#if editingTransaction}
	<EditTransactionDialog
		transaction={editingTransaction}
		_accounts={accounts}
		bind:open={editOpen}
	/>
{/if}

<style>
	:global(.sm\:max-w-2xl) {
		max-width: 42rem;
	}
</style>
