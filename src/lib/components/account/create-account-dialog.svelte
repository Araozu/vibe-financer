<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { enhance } from '$app/forms';
	import { useQueryClient, createQuery } from '@tanstack/svelte-query';
	import {
		CreditCard,
		Type,
		Coins,
		CircleDollarSign,
		ChevronRight,
		Plus,
		Loader2,
		Globe,
		Wallet
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils.js';

	const queryClient = useQueryClient();

	let { open = $bindable(false) } = $props();

	const currenciesQuery = createQuery(() => ({
		queryKey: ['currencies'],
		queryFn: async () => {
			const res = await fetch('/api/currencies');
			return res.json();
		}
	}));

	let currencies = $derived(currenciesQuery.data ?? []);

	let selectedType = $state('asset');
	let createMore = $state(false);
	let accountName = $state('');
	let description = $state('');
	let initialBalance = $state('');
	let currencyId = $state('');
	let color = $state('#3b82f6');
	let isLoading = $state(false);

	$effect(() => {
		if (currencies.length > 0 && !currencyId) {
			currencyId = currencies[0].id;
		}
	});

	const accountTypes = [
		{ value: 'asset', label: 'Asset', icon: CreditCard },
		{ value: 'expense', label: 'Expense', icon: Type },
		{ value: 'revenue', label: 'Revenue', icon: CircleDollarSign },
		{ value: 'liability', label: 'Liability', icon: Coins },
		{ value: 'savings', label: 'Savings', icon: Wallet }
	];

	function resetForm() {
		accountName = '';
		description = '';
		initialBalance = '';
		// Keep other defaults or current selections
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
		<CreditCard class="mr-2 h-4 w-4" />
		Create Account
	</Dialog.Trigger>
	<Dialog.Content class="overflow-hidden p-0 shadow-2xl sm:max-w-2xl">
		<form
			method="POST"
			action="?/createAccount"
			use:enhance={() => {
				isLoading = true;
				return async ({ result }) => {
					isLoading = false;
					if (result.type === 'success') {
						toast.success('Account created successfully');
						// Invalidate accounts queries to refetch
						queryClient.invalidateQueries({ queryKey: ['accounts'] });
						if (!createMore) {
							open = false;
						}
						resetForm();
					} else if (result.type === 'failure') {
						const errorMessage =
							typeof result.data?.error === 'string'
								? result.data.error
								: 'Failed to create account';
						toast.error(errorMessage);
					}
				};
			}}
			class="flex h-full flex-col"
		>
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
					<span>New Account</span>
				</div>
				<div class="flex items-center gap-1"></div>
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
							{#each accountTypes as type (type.value)}
								<Select.Item value={type.value} label={type.label} class="text-xs">
									<type.icon class="mr-2 h-3.5 w-3.5" />
									{type.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="type" value={selectedType} />

					<!-- Currency Select Badge -->
					<Select.Root type="single" bind:value={currencyId}>
						<Select.Trigger
							class="h-8 w-auto gap-2 rounded-md border-none bg-muted/50 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
						>
							<Globe class="h-3.5 w-3.5 text-muted-foreground/60" />
							<span
								>{currencies.find((c: { id: string; code: string }) => c.id === currencyId)?.code ??
									'Select Currency'}</span
							>
						</Select.Trigger>
						<Select.Content>
							{#each currencies as currency (currency.id)}
								<Select.Item value={currency.id} label={currency.code} class="text-xs">
									<div class="flex items-center gap-2">
										<span class="font-bold text-primary">{currency.symbol}</span>
										<span>{currency.code} - {currency.name}</span>
									</div>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="currencyId" value={currencyId} />

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
				class="mt-auto flex items-center justify-between border-t border-border/40 bg-muted/10 px-4 py-3"
			>
				<div class="flex items-center gap-2">
					<Switch id="create-more" bind:checked={createMore} />
					<Label for="create-more" class="cursor-pointer text-xs font-medium text-muted-foreground"
						>Create more</Label
					>
				</div>
				<div class="flex items-center gap-2">
					<Button type="submit" size="sm" disabled={isLoading}>
						{#if isLoading}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{:else}
							<Plus class="mr-2 h-4 w-4" />
						{/if}
						{isLoading ? 'Creating...' : 'Create Account'}
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
