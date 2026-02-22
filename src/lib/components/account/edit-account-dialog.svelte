<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { enhance } from '$app/forms';
	import { useQueryClient } from '@tanstack/svelte-query';
	import {
		CreditCard,
		Type,
		Coins,
		CircleDollarSign,
		ChevronRight,
		Save,
		Loader2,
		Pencil
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { Account } from '$lib/domain/account';
	import { cn } from '$lib/utils.js';

	const queryClient = useQueryClient();

	// We use any here because the account might come from a serialized API response (dates as strings)
	let { open = $bindable(false), account } = $props<{ open?: boolean; account: any }>();

	let selectedType = $state<string>('');
	let accountName = $state<string>('');
	let description = $state<string>('');
	let initialBalance = $state<string>('');
	let currencyId = $state<string>('');
	let color = $state<string>('');
	let isLoading = $state(false);

	// Update local state when dialog opens or account prop changes
	$effect(() => {
		if (open) {
	selectedType = account.type;
	accountName = account.name;
	description = account.description ?? '';
	initialBalance = (account.initialBalance / 100).toString();
	currencyId = account.currencyId;
	color = account.color;
		}
	});

	const accountTypes = [
		{ value: 'asset', label: 'Asset', icon: CreditCard },
		{ value: 'expense', label: 'Expense', icon: Type },
		{ value: 'revenue', label: 'Revenue', icon: CircleDollarSign },
		{ value: 'liability', label: 'Liability', icon: Coins }
	];
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		class={cn(
			buttonVariants({ variant: 'ghost', size: 'icon' }),
			'h-8 w-8 text-muted-foreground hover:text-primary'
		)}
	>
		<Pencil class="h-4 w-4" />
		<span class="sr-only">Edit account</span>
	</Dialog.Trigger>
	<Dialog.Content class="overflow-hidden p-0 shadow-2xl sm:max-w-2xl">
		<form
			method="POST"
			action="?/updateAccount"
			use:enhance={() => {
				isLoading = true;
				return async ({ result }) => {
					isLoading = false;
					if (result.type === 'success') {
						toast.success('Account updated successfully');
						queryClient.invalidateQueries({ queryKey: ['accounts'] });
						open = false;
					} else if (result.type === 'failure') {
						const errorMessage =
							typeof result.data?.error === 'string'
								? result.data.error
								: 'Failed to update account';
						toast.error(errorMessage);
					}
				};
			}}
			class="flex h-full flex-col"
		>
			<input type="hidden" name="id" value={account.id} />

			<!-- Header / Breadcrumbs -->
			<div
				class="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-3"
			>
				<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<div class="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary">
						<CreditCard class="h-3 w-3" />
						<span class="font-bold tracking-wider uppercase">Accounts</span>
					</div>
					<ChevronRight class="h-3 w-3 opacity-50" />
					<span>Edit {account.name}</span>
				</div>
			</div>

			<!-- Main Content -->
			<div class="space-y-6 px-6 py-8">
				<div class="space-y-2">
					<Input
						variant="background"
						id="name"
						name="name"
						placeholder="Account title"
						bind:value={accountName}
						class="h-auto border-none bg-transparent p-0 text-2xl! font-semibold placeholder:text-muted-foreground/40 focus-visible:ring-0"
						required
					/>
					<div class="flex items-center gap-2">
						<Type class="h-4 w-4 text-muted-foreground/60" />
						<Input
							variant="background"
							id="description"
							name="description"
							placeholder="Add a description..."
							bind:value={description}
							class="h-auto w-full border-none bg-transparent p-0 text-sm! placeholder:text-muted-foreground/40 focus-visible:ring-0"
						/>
					</div>
				</div>

				<!-- Metadata Badges Row -->
				<div class="flex flex-wrap gap-2 pt-2">
					<!-- Initial Balance Badge -->
					<div class="flex items-center overflow-hidden rounded-md bg-muted/50">
						<div
							class="border-r border-border/40 px-2 py-1 text-[10px] font-bold tracking-tight text-muted-foreground/60 uppercase"
						>
							BAL
						</div>
					<div class="flex items-center gap-2 px-2">
						<span class="text-xs text-muted-foreground/60">{currencyId ? '$' : '$'}</span>
						<Input
								id="initialBalance"
								name="initialBalance"
								type="number"
								step="0.01"
								placeholder="0.00"
								bind:value={initialBalance}
								class="h-8 w-20 border-none bg-transparent px-2 text-xs font-medium focus-visible:ring-0"
							/>
						</div>
					</div>
					<!-- Type Select Badge -->
					<Select.Root type="single" bind:value={selectedType}>
						<Select.Trigger
							class="h-8 w-auto gap-2 rounded-md border-none bg-muted/50 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
						>
							{@const currentType = accountTypes.find((t) => t.value === selectedType)}
							{#if currentType}
								<currentType.icon class="h-3.5 w-3.5" />
								<span>{currentType.label}</span>
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each accountTypes as type}
								<Select.Item value={type.value} label={type.label} class="text-xs">
									<type.icon class="mr-2 h-3.5 w-3.5" />
									{type.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="type" value={selectedType} />

					<!-- Currency ID Badge -->
					<div class="flex items-center overflow-hidden rounded-md bg-muted/50">
						<div
							class="border-r border-border/40 px-2 py-1 text-[10px] font-bold tracking-tight text-muted-foreground/60 uppercase"
						>
							CUR
						</div>
						<Input
							name="currencyId"
							bind:value={currencyId}
							class="h-8 w-32 border-none bg-transparent px-2 py-1 text-xs font-medium focus-visible:ring-0"
							required
						/>
					</div>

					<!-- Color Picker Badge -->
					<div class="flex items-center overflow-hidden rounded-md bg-muted/50 pr-2">
						<div
							class="border-r border-border/40 px-2 py-1 text-[10px] font-bold tracking-tight text-muted-foreground/60 uppercase"
						>
							CLR
						</div>
						<div class="relative flex items-center gap-2 pl-2">
							<div
								class="h-3 w-3 rounded-full border border-white/20"
								style="background-color: {color}"
							></div>
							<Input
								type="color"
								name="color"
								bind:value={color}
								class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
								required
							/>
							<span class="font-mono text-[10px] text-muted-foreground uppercase">{color}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div
				class="mt-auto flex items-center justify-end border-t border-border/40 bg-muted/10 px-4 py-3"
			>
				<div class="flex items-center gap-2">
					<Button type="submit" size="sm" disabled={isLoading}>
						{#if isLoading}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{:else}
							<Save class="mr-2 h-4 w-4" />
						{/if}
						{isLoading ? 'Saving...' : 'Save Changes'}
					</Button>
				</div>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.sm\:max-w-2xl) {
		max-width: 42rem;
	}
</style>
