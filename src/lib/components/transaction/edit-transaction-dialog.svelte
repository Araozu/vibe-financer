<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { enhance } from '$app/forms';
	import { useQueryClient } from '@tanstack/svelte-query';
	import {
		ArrowDownRight,
		ArrowUpRight,
		ArrowLeftRight,
		Type,
		Tag,
		Calendar,
		Clock,
		Wallet,
		Pencil,
		Loader2
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { format } from 'date-fns';
	import type { Transaction } from '$lib/domain/transaction';
	import TimePicker from '$lib/components/ui/time-picker/time-picker.svelte';

	interface AccountLike {
		id: string;
		name: string;
		color: string;
		currencyId: string;
	}

	const queryClient = useQueryClient();

	let {
		transaction,
		_accounts = [],
		open = $bindable(false)
	}: {
		transaction: Transaction;
		_accounts?: AccountLike[];
		open?: boolean;
	} = $props();

	let selectedType = $state('');
	let selectedAccountId = $state('');
	let transactionName = $state('');
	let description = $state('');
	let amount = $state('');
	let category = $state('');
	let transactionDate = $state('');
	let transactionTime = $state('00:00');
	let userTimezone = $state('');
	let isLoading = $state(false);

	const transactionTypes = [
		{ value: 'expense', label: 'Expense', icon: ArrowUpRight, color: 'text-rose-500' },
		{ value: 'income', label: 'Income', icon: ArrowDownRight, color: 'text-emerald-500' },
		{ value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, color: 'text-blue-500' }
	];

	onMount(() => {
		userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	});

	function resetForm() {
		selectedType = transaction.type;
		selectedAccountId = transaction.accountId;
		transactionName = transaction.name ?? '';
		description = transaction.description ?? '';
		amount = String(transaction.amount / 100);
		category = transaction.category ?? '';
		const d = new Date(transaction.createdAt);
		transactionDate = format(d, 'yyyy-MM-dd');
		transactionTime = format(d, 'HH:mm');
	}

	// Initialize form when transaction changes
	$effect(() => {
		if (transaction) {
			resetForm();
		}
	});

	// Reset form when dialog closes
	$effect(() => {
		if (!open) {
			resetForm();
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Pencil class="h-4 w-4" />
				Edit Transaction
			</Dialog.Title>
			<Dialog.Description>
				Update transaction details. Changes will be recorded in the audit log.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/editTransaction"
			use:enhance={() => {
				isLoading = true;
				return async ({ result }) => {
					isLoading = false;
					if (result.type === 'success') {
						toast.success('Transaction updated successfully');
						queryClient.invalidateQueries({ queryKey: ['transactions'] });
						queryClient.invalidateQueries({ queryKey: ['accounts'] });
						open = false;
					} else if (result.type === 'failure') {
						const errorMessage =
							typeof result.data?.error === 'string'
								? result.data.error
								: 'Failed to update transaction';
						toast.error(errorMessage);
					}
				};
			}}
			class="space-y-6"
		>
			<input type="hidden" name="transactionId" value={transaction.id} />

			<!-- Transfer notice -->
			{#if transaction.type === 'transfer'}
				<div class="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-600 dark:text-blue-400">
					<ArrowLeftRight class="h-4 w-4 shrink-0" />
					<span>Transfer amounts and accounts cannot be edited. You can still update the name, description, and date.</span>
				</div>
			{/if}

			<!-- Type & Account Selectors -->
			<div class="grid grid-cols-2 gap-4">
				<!-- Type Selector -->
				<div class="space-y-2">
					<Label>Transaction Type</Label>
					<Select.Root type="single" bind:value={selectedType} disabled={transaction.type === 'transfer'}>
						<Select.Trigger class="w-full">
							{@const currentType = transactionTypes.find((t) => t.value === selectedType)}
							{#if currentType}
								<currentType.icon class="mr-2 h-4 w-4 {currentType.color}" />
								<span>{currentType.label}</span>
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each transactionTypes as type (type.value)}
								<Select.Item value={type.value} label={type.label}>
									<type.icon class="mr-2 h-4 w-4 {type.color}" />
									{type.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="type" value={selectedType} />
				</div>

				<!-- Account Selector -->
				{#if _accounts.length > 0}
					<div class="space-y-2">
						<Label>
							<div class="flex items-center gap-2">
								<Wallet class="h-3.5 w-3.5 text-muted-foreground" />
								Account
							</div>
						</Label>
						<Select.Root type="single" bind:value={selectedAccountId} disabled={transaction.type === 'transfer'}>
							<Select.Trigger class="w-full">
								<span
									>{_accounts.find((a) => a.id === selectedAccountId)?.name ??
										'Select Account'}</span
								>
							</Select.Trigger>
							<Select.Content>
								{#each _accounts as account (account.id)}
									<Select.Item value={account.id} label={account.name}>
										<div class="flex items-center gap-2">
											<div
												class="h-2 w-2 rounded-full"
												style="background-color: {account.color}"
											></div>
											{account.name}
										</div>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="accountId" value={selectedAccountId} />
					</div>
				{/if}
			</div>

			<!-- Name -->
			<div class="space-y-2">
				<Label for="edit-name">
					<div class="flex items-center gap-2">
						<Type class="h-3.5 w-3.5 text-muted-foreground" />
						Transaction Name
					</div>
				</Label>
				<Input
					id="edit-name"
					name="name"
					placeholder="Transaction title"
					bind:value={transactionName}
					required
				/>
			</div>

			<!-- Description -->
			<div class="space-y-2">
				<Label for="edit-description">Description</Label>
				<Input
					id="edit-description"
					name="description"
					placeholder="Add a description..."
					bind:value={description}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<!-- Amount -->
				<div class="space-y-2">
					<Label for="edit-amount">Amount</Label>
					<div class="relative">
						<span class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
							>$</span
						>
						<Input
							id="edit-amount"
							name="amount"
							type="number"
							step="0.01"
							placeholder="0.00"
							bind:value={amount}
							class="pl-7"
							disabled={transaction.type === 'transfer'}
							required
						/>
					</div>
				</div>

				<!-- Date -->
				<div class="space-y-2">
					<Label for="edit-date">
						<div class="flex items-center gap-2">
							<Calendar class="h-3.5 w-3.5 text-muted-foreground" />
							Date
						</div>
					</Label>
					<Input
						id="edit-date"
						name="date"
						type="date"
						bind:value={transactionDate}
						style="color-scheme: dark"
					/>
				</div>
			</div>

			<!-- Time -->
			<div class="space-y-2">
				<Label>
					<div class="flex items-center gap-2">
						<Clock class="h-3.5 w-3.5 text-muted-foreground" />
						Time
					</div>
				</Label>
				<div class="flex items-center gap-2">
					<TimePicker bind:value={transactionTime} />
					<input type="hidden" name="time" value={transactionTime} />
					<input type="hidden" name="timezone" value={userTimezone} />
				</div>
			</div>

			{#if selectedType !== 'transfer'}
				<div class="grid grid-cols-2 gap-4">
					<!-- Category -->
					<div class="space-y-2">
						<Label for="edit-category">
							<div class="flex items-center gap-2">
								<Tag class="h-3.5 w-3.5 text-muted-foreground" />
								Category
							</div>
						</Label>
						<Input
							id="edit-category"
							name="category"
							bind:value={category}
							placeholder="Category..."
						/>
					</div>
				</div>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={isLoading}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<Pencil class="mr-2 h-4 w-4" />
					{/if}
					{isLoading ? 'Updating...' : 'Update Transaction'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
