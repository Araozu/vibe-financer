<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { enhance } from '$app/forms';
	import { 
		CreditCard, 
		Type, 
		Coins, 
		Palette, 
		CircleDollarSign,
		Maximize2,
		X,
		ChevronRight,
		Check
	} from "@lucide/svelte";
	import { cn } from "$lib/utils";

	let { open = $bindable(false) } = $props();
	
	let selectedType = $state("asset");
	let createMore = $state(false);
	let accountName = $state("");
	let initialBalance = $state("");
	let currencyCode = $state("USD");
	let currencySymbol = $state("$");
	let color = $state("#3b82f6");

	const accountTypes = [
		{ value: "asset", label: "Asset", icon: CreditCard },
		{ value: "expense", label: "Expense", icon: Type },
		{ value: "revenue", label: "Revenue", icon: CircleDollarSign },
		{ value: "liability", label: "Liability", icon: Coins },
	];

	function resetForm() {
		accountName = "";
		initialBalance = "";
		// Keep other defaults or current selections
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		<Button variant="outline" size="sm">
			<CreditCard class="mr-2 h-4 w-4" />
			Accounts
		</Button>
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-background">
		<form 
			method="POST" 
			action="?/createAccount" 
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						if (!createMore) {
							open = false;
						}
						resetForm();
					}
				};
			}} 
			class="flex flex-col h-full"
		>
			<!-- Header / Breadcrumbs -->
			<div class="px-4 py-3 flex items-center justify-between border-b border-border/40 bg-muted/30">
				<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<div class="flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded">
						<CreditCard class="h-3 w-3" />
						<span class="uppercase tracking-wider font-bold">Accounts</span>
					</div>
					<ChevronRight class="h-3 w-3 opacity-50" />
					<span>New Account</span>
				</div>
				<div class="flex items-center gap-1">
					<Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-foreground">
						<Maximize2 class="h-3.5 w-3.5" />
					</Button>
					<Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-foreground" onclick={() => open = false}>
						<X class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<!-- Main Content -->
			<div class="px-6 py-8 space-y-6">
				<div class="space-y-2">
					<Input 
						id="name" 
						name="name" 
						placeholder="Account title" 
						bind:value={accountName}
						class="text-2xl font-semibold border-none bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 h-auto" 
						required 
					/>
					<div class="flex items-center gap-2">
						<CircleDollarSign class="h-4 w-4 text-muted-foreground/60" />
						<Input 
							id="initialBalance" 
							name="initialBalance" 
							type="number" 
							step="0.01" 
							placeholder="Initial balance..." 
							bind:value={initialBalance}
							class="text-sm border-none bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 h-auto w-full" 
							required 
						/>
					</div>
				</div>

				<!-- Metadata Badges Row -->
				<div class="flex flex-wrap gap-2 pt-2">
					<!-- Type Select Badge -->
					<Select.Root type="single" bind:value={selectedType}>
						<Select.Trigger class="w-auto h-8 px-2.5 py-1.5 text-xs font-medium bg-muted/50 border-none hover:bg-muted transition-colors rounded-md gap-2">
							{@const currentType = accountTypes.find(t => t.value === selectedType)}
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

					<!-- Currency Code Badge -->
					<div class="flex items-center bg-muted/50 rounded-md overflow-hidden">
						<div class="px-2 py-1 border-r border-border/40 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">CUR</div>
						<Input 
							name="currencyCode" 
							bind:value={currencyCode}
							class="w-14 h-8 px-2 py-1 text-xs border-none bg-transparent focus-visible:ring-0 uppercase font-medium" 
							required 
						/>
					</div>

					<!-- Currency Symbol Badge -->
					<div class="flex items-center bg-muted/50 rounded-md overflow-hidden">
						<div class="px-2 py-1 border-r border-border/40 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">SYM</div>
						<Input 
							name="currencySymbol" 
							bind:value={currencySymbol}
							class="w-10 h-8 px-2 py-1 text-xs border-none bg-transparent focus-visible:ring-0 font-medium" 
							required 
						/>
					</div>

					<!-- Color Picker Badge -->
					<div class="flex items-center bg-muted/50 rounded-md overflow-hidden pr-2">
						<div class="px-2 py-1 border-r border-border/40 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">CLR</div>
						<div class="relative flex items-center gap-2 pl-2">
							<div class="h-3 w-3 rounded-full border border-white/20" style="background-color: {color}"></div>
							<Input 
								type="color" 
								name="color" 
								bind:value={color}
								class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
								required 
							/>
							<span class="text-[10px] font-mono text-muted-foreground uppercase">{color}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="mt-auto px-4 py-3 flex items-center justify-between border-t border-border/40 bg-muted/10">
				<div class="flex items-center gap-2">
					<Switch id="create-more" bind:checked={createMore} />
					<Label for="create-more" class="text-xs text-muted-foreground font-medium cursor-pointer">Create more</Label>
				</div>
				<div class="flex items-center gap-2">
					<Button type="submit" size="sm" class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 shadow-lg shadow-indigo-500/20">
						Create Account
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
