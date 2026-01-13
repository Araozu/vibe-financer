<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { enhance } from '$app/forms';
	import { 
		ArrowDownRight, 
		ArrowUpRight, 
		Type, 
		Tag,
		User as UserIcon,
		Wallet,
		ChevronRight,
		Plus
	} from "@lucide/svelte";
	import type { Account } from "$lib/domain/account";
	import { toast } from "svelte-sonner";
	import { onMount, tick } from "svelte";

	let { open = $bindable(false), accounts = [] } = $props<{ open?: boolean, accounts: Account[] }>();
	
	let selectedType = $state("expense");
	let selectedAccountId = $state("");
	
	$effect(() => {
		if (accounts.length > 0 && !selectedAccountId) {
			selectedAccountId = accounts[0].id;
		}
	});

	let createMore = $state(false);
	let transactionName = $state("");
	let description = $state("");
	let amount = $state("");
	let category = $state("");
	let payee = $state("");

	let titleInput: HTMLInputElement | null = $state(null);

	onMount(() => {
		const stored = localStorage.getItem("createMoreTransactions");
		if (stored !== null) {
			createMore = stored === "true";
		}
	});

	$effect(() => {
		localStorage.setItem("createMoreTransactions", String(createMore));
	});

	const transactionTypes = [
		{ value: "expense", label: "Expense", icon: ArrowDownRight, color: "text-rose-500" },
		{ value: "income", label: "Income", icon: ArrowUpRight, color: "text-emerald-500" },
	];

	function resetForm() {
		transactionName = "";
		description = "";
		amount = "";
		category = "";
		payee = "";
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		<Button size="sm">
			<Plus class="mr-2 h-4 w-4" />
			Add Transaction
		</Button>
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-2xl p-0 overflow-hidden shadow-2xl bg-background">
		<form 
			method="POST" 
			action="?/createTransaction" 
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						toast.success("Transaction created successfully");
						resetForm();
						
						if (!createMore) {
							open = false;
						} else {
							await tick();
							titleInput?.focus();
						}
					}
				};
			}} 
			class="flex flex-col h-full"
		>
			<!-- Header / Breadcrumbs -->
			<div class="px-4 py-3 flex items-center justify-between border-b border-border/40 bg-muted/30">
				<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<div class="flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded">
						<Plus class="h-3 w-3" />
						<span class="uppercase tracking-wider font-bold">Transactions</span>
					</div>
					<ChevronRight class="h-3 w-3 opacity-50" />
					<span>New {selectedType === 'expense' ? 'Expense' : 'Income'}</span>
				</div>
			</div>

			<!-- Main Content -->
			<div class="px-6 py-8 space-y-6">
				<div class="space-y-2">
					<Input 
						variant="background"
						id="name" 
						name="name" 
						placeholder="Transaction title (e.g., Grocery Shopping)" 
						bind:value={transactionName}
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

				<!-- Metadata Badges Row -->
				<div class="flex flex-wrap gap-2 pt-2">
					<!-- Amount Badge -->
					<div class="flex items-center bg-muted/50 rounded-md overflow-hidden border border-primary/30">
						<div class="px-2 py-1 border-r border-border/40 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">AMT</div>
						<div class="flex items-center px-2 gap-2">
							<span class="text-xs text-muted-foreground/60">$</span>
							<Input 
								id="amount" 
								name="amount" 
								type="number" 
								step="0.01" 
								placeholder="0.00" 
								bind:value={amount}
								class="w-24 h-8 px-2 text-xs border-none bg-transparent focus-visible:ring-0 font-medium" 
								required 
							/>
						</div>
					</div>

					<!-- Account Select Badge -->
					<Select.Root type="single" bind:value={selectedAccountId}>
						<Select.Trigger class="w-auto min-w-40 h-8 px-2.5 py-1.5 text-xs font-medium bg-muted/50 border-none hover:bg-muted transition-colors rounded-md gap-2">
							<Wallet class="h-3.5 w-3.5" />
							<span>{accounts.find((a: Account) => a.id === selectedAccountId)?.name || "Select Account"}</span>
						</Select.Trigger>
						<Select.Content>
							{#each accounts as account}
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

					<!-- Type Select Badge -->
					<Select.Root type="single" bind:value={selectedType}>
						<Select.Trigger class="w-32 h-8 px-2.5 py-1.5 text-xs font-medium bg-muted/50 border-none hover:bg-muted transition-colors rounded-md gap-2">
							{@const currentType = transactionTypes.find(t => t.value === selectedType)}
							{#if currentType}
								<currentType.icon class="h-3.5 w-3.5 {currentType.color}" />
								<span>{currentType.label}</span>
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each transactionTypes as type}
								<Select.Item value={type.value} label={type.label} class="text-xs">
									<type.icon class="mr-2 h-3.5 w-3.5 {type.color}" />
									{type.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="type" value={selectedType} />

					<!-- Category Badge -->
					<div class="flex items-center bg-muted/50 rounded-md overflow-hidden">
						<div class="px-2 py-1 border-r border-border/40 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">CAT</div>
						<div class="flex items-center px-2 gap-2">
							<Tag class="h-3.5 w-3.5 text-muted-foreground/60" />
							<Input 
								name="category" 
								bind:value={category}
								placeholder="Category..."
								class="w-28 h-8 px-2 py-1 text-xs border-none bg-transparent focus-visible:ring-0 font-medium" 
							/>
						</div>
					</div>

					<!-- Payee Badge -->
					<div class="flex items-center bg-muted/50 rounded-md overflow-hidden">
						<div class="px-2 py-1 border-r border-border/40 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">PAY</div>
						<div class="flex items-center px-2 gap-2">
							<UserIcon class="h-3.5 w-3.5 text-muted-foreground/60" />
							<Input 
								name="payee" 
								bind:value={payee}
								placeholder="Payee..."
								class="w-28 h-8 px-2 py-1 text-xs border-none bg-transparent focus-visible:ring-0 font-medium" 
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="mt-auto px-4 py-3 flex items-center justify-between border-t border-border/40 bg-muted/10">
				<div class="flex items-center gap-2">
					<Switch id="create-more-tx" bind:checked={createMore} />
					<Label for="create-more-tx" class="text-xs text-muted-foreground font-medium cursor-pointer">Create more</Label>
				</div>
				<div class="flex items-center gap-2">
					<Button type="submit" size="sm">
						<Plus class="mr-2 h-4 w-4" />
						Add Transaction
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
