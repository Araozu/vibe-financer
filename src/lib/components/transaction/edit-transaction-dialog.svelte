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
		Type,
		Tag,
		User as UserIcon,
		Calendar,
		Pencil,
		Loader2
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { Transaction } from '$lib/domain/transaction';

	interface AccountLike {
		id: string;
		name: string;
		color: string;
		currencyId: string;
	}

	const queryClient = useQueryClient();

	let {
		transaction,
		accounts = [],
		open = $bindable(false)
	}: {
		transaction: Transaction;
		accounts: AccountLike[];
		open?: boolean;
	} = $props();

	let selectedType = $state('');
	let transactionName = $state('');
	let description = $state('');
	let amount = $state('');
	let category = $state('');
	let payee = $state('');
	let transactionDate = $state('');
	let isLoading = $state(false);

	const transactionTypes = [
		{ value: 'expense', label: 'Expense', icon: ArrowDownRight, color: 'text-rose-500' },
		{ value: 'income', label: 'Income', icon: ArrowUpRight, color: 'text-emerald-500' }
	];

	function resetForm() {
		selectedType = transaction.type;
		transactionName = transaction.name ?? '';
		description = transaction.description ?? '';
		amount = String(transaction.amount / 100);
		category = transaction.category ?? '';
		payee = transaction.payee ?? '';
		transactionDate = new Date(transaction.createdAt).toISOString().split('T')[0];
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

			<!-- Type Selector -->
			<div class="space-y-2">
				<Label>Transaction Type</Label>
				<Select.Root type="single" bind:value={selectedType}>
					<Select.Trigger class="w-full">
						{@const currentType = transactionTypes.find((t) => t.value === selectedType)}
						{#if currentType}
							<currentType.icon class="mr-2 h-4 w-4 {currentType.color}" />
							<span>{currentType.label}</span>
						{/if}
					</Select.Trigger>
					<Select.Content>
						{#each transactionTypes as type}
							<Select.Item value={type.value} label={type.label}>
								<type.icon class="mr-2 h-4 w-4 {type.color}" />
								{type.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="type" value={selectedType} />
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

					<!-- Payee -->
					<div class="space-y-2">
						<Label for="edit-payee">
							<div class="flex items-center gap-2">
								<UserIcon class="h-3.5 w-3.5 text-muted-foreground" />
								Payee
							</div>
						</Label>
						<Input id="edit-payee" name="payee" bind:value={payee} placeholder="Payee..." />
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
