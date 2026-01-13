<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { enhance } from '$app/forms';
	import { 
		ArrowRightLeft, 
		Type, 
		Wallet,
		ChevronRight,
		Plus
	} from "@lucide/svelte";
	import type { Account } from "$lib/domain/account";
	import { toast } from "svelte-sonner";
	import { onMount, tick } from "svelte";

	let { 
		accounts = [], 
		onSuccess, 
		showCreateMore = true,
		class: className = ""
	} = $props<{ 
		accounts: Account[], 
		onSuccess?: (createMore: boolean) => void,
		showCreateMore?: boolean,
		class?: string
	}>();
	
	let selectedFromAccountId = $state("");
	let selectedToAccountId = $state("");
	
	// Get accounts with same currency as from account
	let availableToAccounts = $derived.by(() => {
		if (!selectedFromAccountId) return accounts;
		const fromAccount = accounts.find(a => a.id === selectedFromAccountId);
		if (!fromAccount) return [];
		return accounts.filter(a => 
			a.id !== selectedFromAccountId && 
			a.currencyCode === fromAccount.currencyCode
		);
	});

	$effect(() => {
		if (accounts.length > 0 && !selectedFromAccountId) {
			selectedFromAccountId = accounts[0].id;
		}
	});

	$effect(() => {
		// Reset toAccount if it's no longer valid
		if (selectedToAccountId && !availableToAccounts.find(a => a.id === selectedToAccountId)) {
			selectedToAccountId = availableToAccounts[0]?.id || "";
		}
	});

	let createMore = $state(false);
	let transferName = $state("");
	let description = $state("");
	let amount = $state("");
	let isSubmitting = $state(false);

	let titleInput: HTMLInputElement | null = $state(null);

	onMount(() => {
		if (showCreateMore) {
			const stored = localStorage.getItem("createMoreTransfers");
			if (stored !== null) {
				createMore = stored === "true";
			}
		} else {
			createMore = false;
		}
	});

	$effect(() => {
		if (showCreateMore) {
			localStorage.setItem("createMoreTransfers", String(createMore));
		}
	});

	function resetForm() {
		transferName = "";
		description = "";
		amount = "";
	}
</script>

<form 
	method="POST" 
	action="?/createTransfer" 
	use:enhance={() => {
		isSubmitting = true;
		return async ({ result }) => {
			isSubmitting = false;
			if (result.type === 'success') {
				toast.success("Transfer created successfully");
				resetForm();
				
				if (onSuccess) {
					onSuccess(createMore);
				}
				
				await tick();
				titleInput?.focus();
			} else if (result.type === 'failure') {
				toast.error(result.data?.error || "Failed to create transfer");
			}
		};
	}} 
	class="flex flex-col h-full {className}"
>
	<!-- Header / Breadcrumbs -->
	<div class="px-4 py-3 flex items-center justify-between border-b border-border/40 bg-muted/30">
		<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
			<div class="flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded">
				<Plus class="h-3 w-3" />
				<span class="uppercase tracking-wider font-bold">Transfers</span>
			</div>
			<ChevronRight class="h-3 w-3 opacity-50" />
			<span>New Transfer</span>
		</div>
	</div>

	<!-- Main Content -->
	<div class="px-6 py-8 space-y-6">
		<div class="space-y-2">
			<Input 
				variant="background"
				id="name" 
				name="name" 
				placeholder="Transfer title (e.g., Moving to Savings)" 
				bind:value={transferName}
				bind:ref={titleInput}
				class="text-2xl! font-semibold border-none bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 h-auto" 
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
					class="text-sm! border-none bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 h-auto w-full" 
				/>
			</div>
		</div>

		<!-- Transfer Flow Visualization -->
		<div class="flex items-center gap-3 py-4">
			<div class="flex-1 text-center">
				<p class="text-xs text-muted-foreground mb-2 uppercase font-bold tracking-wider">From</p>
				<Select.Root type="single" bind:value={selectedFromAccountId}>
					<Select.Trigger class="w-full h-10 px-3 py-2 text-sm font-medium bg-muted/50 border hover:bg-muted transition-colors rounded-md gap-2">
						<Wallet class="h-4 w-4" />
						<span class="truncate">{accounts.find((a: Account) => a.id === selectedFromAccountId)?.name || "Select Account"}</span>
					</Select.Trigger>
					<Select.Content>
						{#each accounts as account}
							<Select.Item value={account.id} label={account.name} class="text-sm">
								<div class="flex items-center gap-2">
									<div class="h-2 w-2 rounded-full" style="background-color: {account.color}"></div>
									<span class="truncate">{account.name}</span>
									<span class="text-muted-foreground text-xs">({account.currencyCode})</span>
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<ArrowRightLeft class="h-5 w-5 text-primary" />
			<div class="flex-1 text-center">
				<p class="text-xs text-muted-foreground mb-2 uppercase font-bold tracking-wider">To</p>
				<Select.Root type="single" bind:value={selectedToAccountId}>
					<Select.Trigger 
						class="w-full h-10 px-3 py-2 text-sm font-medium bg-muted/50 border hover:bg-muted transition-colors rounded-md gap-2"
						disabled={availableToAccounts.length === 0}
					>
						<Wallet class="h-4 w-4" />
						<span class="truncate">
							{#if availableToAccounts.length === 0}
								No matching accounts
							{:else}
								{availableToAccounts.find((a: Account) => a.id === selectedToAccountId)?.name || "Select Account"}
							{/if}
						</span>
					</Select.Trigger>
					<Select.Content>
						{#each availableToAccounts as account}
							<Select.Item value={account.id} label={account.name} class="text-sm">
								<div class="flex items-center gap-2">
									<div class="h-2 w-2 rounded-full" style="background-color: {account.color}"></div>
									<span class="truncate">{account.name}</span>
									<span class="text-muted-foreground text-xs">({account.currencyCode})</span>
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
		<input type="hidden" name="fromAccountId" value={selectedFromAccountId} />
		<input type="hidden" name="toAccountId" value={selectedToAccountId} />

		<!-- Amount -->
		<div class="flex flex-col gap-2">
			<Label for="amount" class="text-sm font-medium text-muted-foreground">Transfer Amount</Label>
			<div class="flex items-center bg-muted/50 rounded-md overflow-hidden border border-primary/30">
				<div class="px-3 py-2 border-r border-border/40 text-sm font-bold text-muted-foreground/60">
					{accounts.find(a => a.id === selectedFromAccountId)?.currencySymbol || "$"}
				</div>
				<Input 
					id="amount" 
					name="amount" 
					type="number" 
					step="0.01" 
					placeholder="0.00" 
					bind:value={amount}
					class="flex-1 h-10 px-3 text-base border-none bg-transparent focus-visible:ring-0 font-medium" 
					required 
				/>
			</div>
		</div>

		{#if availableToAccounts.length === 0 && selectedFromAccountId}
			<div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
				<p class="text-sm text-amber-600 dark:text-amber-400">
					No accounts with matching currency ({accounts.find(a => a.id === selectedFromAccountId)?.currencyCode}). 
					Transfers require accounts with the same currency.
				</p>
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div class="mt-auto px-4 py-3 flex items-center justify-between border-t border-border/40 bg-muted/10">
		<div class="flex items-center gap-2">
			{#if showCreateMore}
				<Switch id="create-more-transfer" bind:checked={createMore} />
				<Label for="create-more-transfer" class="text-xs text-muted-foreground font-medium cursor-pointer">Create more</Label>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<Button 
				type="submit" 
				size="sm" 
				disabled={isSubmitting || !selectedToAccountId || availableToAccounts.length === 0}
			>
				{#if isSubmitting}
					<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
					Creating...
				{:else}
					<Plus class="mr-2 h-4 w-4" />
					Create Transfer
				{/if}
			</Button>
		</div>
	</div>
</form>
