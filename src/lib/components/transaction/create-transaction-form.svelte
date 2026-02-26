<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { enhance } from '$app/forms';
	import { useQueryClient, createQuery } from '@tanstack/svelte-query';
	import {
		ArrowDownRight,
		ArrowUpRight,
		ArrowLeftRight,
		Type,
		Tag,
		Wallet,
		ChevronRight,
		Plus,
		Loader2,
		Clock
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { onMount, tick } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import TimePicker from '$lib/components/ui/time-picker/time-picker.svelte';

	// Minimal account type for what this component needs
	interface AccountLike {
		id: string;
		name: string;
		color: string;
		currencyId: string;
	}

	const queryClient = useQueryClient();

	// Query for budgets to get categories
	const budgetsQuery = createQuery(() => ({
		queryKey: ['budgets'],
		queryFn: async () => (await fetch('/api/budgets')).json()
	}));

	let budgets = $derived(budgetsQuery.data ?? []);
	let categories = $derived([...new Set(budgets.map((b: { category: string }) => b.category))]);

	let {
		accounts = [],
		onSuccess,
		showCreateMore = true,
		class: className = ''
	}: {
		accounts: AccountLike[];
		onSuccess?: (createMore: boolean) => void;
		showCreateMore?: boolean;
		class?: string;
	} = $props();

	let selectedType = $state('expense');
	let selectedAccountId = $state('');
	let selectedToAccountId = $state('');
	let isLoading = $state(false);

	$effect(() => {
		if (accounts.length > 0 && !selectedAccountId) {
			selectedAccountId = accounts[0].id;
		}
	});

	// Filter accounts for transfer destination (same currency, different account)
	let availableToAccounts = $derived(
		selectedType === 'transfer' && selectedAccountId
			? accounts.filter((acc) => {
					const fromAccount = accounts.find((a) => a.id === selectedAccountId);
					return acc.id !== selectedAccountId && acc.currencyId === fromAccount?.currencyId;
				})
			: []
	);

	$effect(() => {
		// Reset to account when changing from account or switching to transfer
		if (selectedType === 'transfer' && availableToAccounts.length > 0) {
			// Only update if current selection is invalid
			const isCurrentValid =
				selectedToAccountId && availableToAccounts.find((a) => a.id === selectedToAccountId);
			if (!isCurrentValid) {
				selectedToAccountId = availableToAccounts[0].id;
			}
		} else if (selectedType !== 'transfer') {
			// Clear selection when not in transfer mode
			selectedToAccountId = '';
		}
	});

	let createMore = $state(false);
	let transactionName = $state('');
	let description = $state('');
	let amount = $state('');
	let category = $state('');
	let _payee = $state('');
	let transactionDate = $state(new Date().toISOString().split('T')[0]);
	let transactionTime = $state(
		new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
	);
	let userTimezone = $state('');

	let titleInput: HTMLInputElement | null = $state(null);

	onMount(() => {
		userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (showCreateMore) {
			const stored = localStorage.getItem('createMoreTransactions');
			if (stored !== null) {
				createMore = stored === 'true';
			}
		} else {
			createMore = false;
		}

		// Update time on mount to be current
		transactionTime = new Date().toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit'
		});
	});

	$effect(() => {
		if (showCreateMore) {
			localStorage.setItem('createMoreTransactions', String(createMore));
		}
	});

	const transactionTypes = [
		{ value: 'expense', label: 'Expense', icon: ArrowUpRight, color: 'text-rose-500' },
		{ value: 'income', label: 'Income', icon: ArrowDownRight, color: 'text-emerald-500' },
		{ value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, color: 'text-blue-500' }
	];

	function resetForm() {
		transactionName = '';
		description = '';
		amount = '';
		category = '';
		_payee = '';
		// We no longer reset transactionDate and transactionTime and selectedToAccountId here
		// as per user request to keep their values on submit.
	}

	function addDayToDate() {
		const current = transactionDate
			? new SvelteDate(transactionDate + 'T00:00:00')
			: new SvelteDate();
		current.setDate(current.getDate() + 1);
		transactionDate = current.toISOString().split('T')[0];
	}

	function subtractDayFromDate() {
		const current = transactionDate
			? new SvelteDate(transactionDate + 'T00:00:00')
			: new SvelteDate();
		current.setDate(current.getDate() - 1);
		transactionDate = current.toISOString().split('T')[0];
	}

	function resetTime() {
		transactionTime = new Date().toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<form
	method="POST"
	action="?/createTransaction"
	use:enhance={() => {
		isLoading = true;
		return async ({ result }) => {
			isLoading = false;
			if (result.type === 'success') {
				toast.success('Transaction created successfully');
				// Invalidate queries to refetch updated data
				queryClient.invalidateQueries({ queryKey: ['transactions'] });
				queryClient.invalidateQueries({ queryKey: ['accounts'] });
				queryClient.invalidateQueries({ queryKey: ['budgets'] });
				resetForm();

				if (onSuccess) {
					onSuccess(createMore);
				}

				await tick();
				titleInput?.focus();
			} else if (result.type === 'failure') {
				const errorMessage =
					typeof result.data?.error === 'string'
						? result.data.error
						: 'Failed to create transaction';
				toast.error(errorMessage);
			}
		};
	}}
	class="flex h-full flex-col {className}"
>
	<!-- Header / Selectors -->
	<div class="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 py-3">
		<!-- Type Select -->
		<Select.Root type="single" bind:value={selectedType}>
			<Select.Trigger
				class="h-8 w-32 gap-2 rounded-md border border-border/40 bg-linear-to-b from-background to-accent/10 px-2.5 py-1.5 text-xs font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(0,0,0,0.1)] transition-all hover:to-accent/20 active:translate-y-px active:shadow-inner dark:from-muted/15 dark:to-muted/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_1.5px_3px_rgba(0,0,0,0.3)]"
			>
				{@const currentType = transactionTypes.find((t) => t.value === selectedType)}
				{#if currentType}
					<currentType.icon class="h-3.5 w-3.5 {currentType.color}" />
					<span>{currentType.label}</span>
				{/if}
			</Select.Trigger>
			<Select.Content>
				{#each transactionTypes as type (type.value)}
					<Select.Item value={type.value} label={type.label} class="text-xs">
						<type.icon class="mr-2 h-3.5 w-3.5 {type.color}" />
						{type.label}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<input type="hidden" name="type" value={selectedType} />

		<ChevronRight class="h-3 w-3 opacity-30" />

		<!-- Account Select -->
		<Select.Root type="single" bind:value={selectedAccountId}>
			<Select.Trigger
				class="h-8 w-auto gap-2 rounded-md border border-border/40 bg-linear-to-b from-background to-accent/10 px-2.5 py-1.5 text-xs font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(0,0,0,0.1)] transition-all hover:to-accent/20 active:translate-y-px active:shadow-inner dark:from-muted/15 dark:to-muted/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_1.5px_3px_rgba(0,0,0,0.3)]"
			>
				<Wallet class="h-3.5 w-3.5 text-muted-foreground/60" />
				<span>{accounts.find((a) => a.id === selectedAccountId)?.name ?? 'Select Account'}</span>
			</Select.Trigger>
			<Select.Content>
				{#each accounts as account (account.id)}
					<Select.Item value={account.id} label={account.name} class="text-xs">
						<div class="flex items-center gap-2">
							<div class="h-2 w-2 rounded-full" style="background-color: {account.color}"></div>
							{account.name}
						</div>
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<input type="hidden" name="accountId" value={selectedAccountId} />

		<!-- To Account Select (for transfers) -->
		{#if selectedType === 'transfer'}
			<ChevronRight class="h-3 w-3 opacity-30" />
			{#if availableToAccounts.length > 0}
				<Select.Root type="single" bind:value={selectedToAccountId}>
					<Select.Trigger
						class="h-8 w-auto gap-2 rounded-md border border-blue-500/30 bg-linear-to-b from-blue-500/5 to-blue-500/10 px-2.5 py-1.5 text-xs font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(0,0,0,0.1)] transition-all hover:to-blue-500/20 active:translate-y-px active:shadow-inner dark:from-blue-600/20 dark:to-blue-600/10 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_1.5px_3px_rgba(0,0,0,0.3)]"
					>
						<ArrowLeftRight class="h-3.5 w-3.5 text-blue-500" />
						<span
							>{availableToAccounts.find((a) => a.id === selectedToAccountId)?.name ??
								'To Account'}</span
						>
					</Select.Trigger>
					<Select.Content>
						{#each availableToAccounts as account (account.id)}
							<Select.Item value={account.id} label={account.name} class="text-xs">
								<div class="flex items-center gap-2">
									<div class="h-2 w-2 rounded-full" style="background-color: {account.color}"></div>
									{account.name}
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="toAccountId" value={selectedToAccountId} />
			{:else}
				<div
					class="flex h-8 items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-500"
				>
					No compatible accounts
				</div>
			{/if}
		{/if}
	</div>

	<!-- Main Content -->
	<div class="space-y-6 px-6 py-8">
		<div class="space-y-2">
			<Input
				variant="background"
				id="name"
				name="name"
				placeholder="Transaction title (e.g., Grocery Shopping)"
				bind:value={transactionName}
				bind:ref={titleInput}
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
			<!-- Amount Badge -->
			<div
				class="flex items-center overflow-hidden rounded-md border border-rose-500/30 bg-muted/50"
			>
				<div
					class="border-r border-border/40 px-2 py-1 text-[10px] font-bold tracking-tight text-muted-foreground/60 uppercase"
				>
					AMT
				</div>
				<div class="flex items-center gap-2 px-2">
					<span class="text-xs text-muted-foreground/60">$</span>
					<Input
						id="amount"
						name="amount"
						type="number"
						step="0.01"
						placeholder="0.00"
						bind:value={amount}
						class="h-8 w-24 border-none bg-transparent px-2 text-xs font-medium focus-visible:ring-0"
						required
					/>
				</div>
			</div>

			<!-- Category Badge (hidden for transfers) -->
			{#if selectedType !== 'transfer'}
				<div
					class="flex items-center overflow-hidden rounded-md border border-border/40 bg-muted/50"
				>
					<div
						class="border-r border-border/40 px-2 py-1 text-[10px] font-bold tracking-tight text-muted-foreground/60 uppercase"
					>
						CAT
					</div>
					<div class="flex items-center gap-2 px-2">
						<Tag class="h-3.5 w-3.5 text-muted-foreground/60" />
						<div class="relative">
							<Input
								name="category"
								bind:value={category}
								placeholder="Category..."
								class="h-8 w-28 border-none bg-transparent px-2 py-1 text-xs font-medium focus-visible:ring-0"
								list="budget-categories"
							/>
							<datalist id="budget-categories">
								{#each categories as cat (cat)}
									<option value={cat}>{cat}</option>
								{/each}
							</datalist>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Date & Time Row -->
		<div class="flex flex-wrap gap-2 pt-0">
			<!-- Date Badge -->
			<div class="flex items-center overflow-hidden rounded-md border border-border/40 bg-muted/50">
				<div
					class="border-r border-border/40 px-2 py-1 text-[10px] font-bold tracking-tight text-muted-foreground/60 uppercase"
				>
					DATE
				</div>
				<div class="flex items-center gap-2 px-2">
					<Input
						id="date"
						name="date"
						type="date"
						bind:value={transactionDate}
						class="h-8 w-32 border-none bg-transparent px-2 text-xs font-medium focus-visible:ring-0"
						style="color-scheme: dark"
					/>
					<div class="flex items-center border-l border-border/40 pl-1">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="h-6 w-8 px-0 text-[10px] font-bold text-muted-foreground hover:text-primary"
							onclick={subtractDayFromDate}
						>
							-1
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="h-6 w-8 px-0 text-[10px] font-bold text-muted-foreground hover:text-primary"
							onclick={addDayToDate}
						>
							+1
						</Button>
					</div>
				</div>
			</div>

			<!-- Time Badge -->
			<div class="flex items-center overflow-hidden rounded-md border border-border/40 bg-muted/50">
				<div
					class="border-r border-border/40 px-2 py-1 text-[10px] font-bold tracking-tight text-muted-foreground/60 uppercase"
				>
					TIME
				</div>
				<div class="flex items-center gap-2 px-2">
					<Clock class="h-3.5 w-3.5 text-muted-foreground/60" />
					<TimePicker bind:value={transactionTime} />
					<input type="hidden" name="time" value={transactionTime} />
					<input type="hidden" name="timezone" value={userTimezone} />
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-6 px-2 text-[10px] font-bold text-muted-foreground uppercase hover:text-primary"
						onclick={resetTime}
					>
						Reset
					</Button>
				</div>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<div
		class="mt-auto flex items-center justify-between border-t border-border/40 bg-muted/10 px-4 py-3"
	>
		<div class="flex items-center gap-2">
			{#if showCreateMore}
				<Switch id="create-more-tx" bind:checked={createMore} />
				<Label for="create-more-tx" class="cursor-pointer text-xs font-medium text-muted-foreground"
					>Create more</Label
				>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<Button
				type="submit"
				size="sm"
				disabled={isLoading ||
					accounts.length === 0 ||
					(selectedType === 'transfer' && availableToAccounts.length === 0)}
			>
				{#if isLoading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<Plus class="mr-2 h-4 w-4" />
				{/if}
				{isLoading ? 'Adding...' : 'Add Transaction'}
			</Button>
		</div>
	</div>
</form>
