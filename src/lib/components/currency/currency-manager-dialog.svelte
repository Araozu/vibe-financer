<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { enhance } from '$app/forms';
	import { useQueryClient, createQuery } from '@tanstack/svelte-query';
	import { Coins, ChevronRight, Plus, Loader2, Globe, Tag, Type } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils.js';
	import * as Table from '$lib/components/ui/table/index.js';

	const queryClient = useQueryClient();

	let { open = $bindable(false) } = $props();

	let code = $state('');
	let symbol = $state('');
	let name = $state('');
	let isLoading = $state(false);

	const currenciesQuery = createQuery(() => ({
		queryKey: ['currencies'],
		queryFn: async () => {
			const res = await fetch('/api/currencies');
			return res.json();
		}
	}));

	let currencies = $derived(currenciesQuery.data ?? []);

	function resetForm() {
		code = '';
		symbol = '';
		name = '';
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
		<Coins class="mr-2 h-4 w-4" />
		Currencies
	</Dialog.Trigger>
	<Dialog.Content class="overflow-hidden p-0 shadow-2xl sm:max-w-2xl">
		<div class="flex h-[600px] flex-col">
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-3"
			>
				<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<div class="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary">
						<Coins class="h-3 w-3" />
						<span class="font-bold tracking-wider uppercase">Currencies</span>
					</div>
					<ChevronRight class="h-3 w-3 opacity-50" />
					<span>Manage Currencies</span>
				</div>
			</div>

			<div class="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
				<!-- List side -->
				<div class="flex flex-col border-r border-border/40 bg-muted/10">
					<div class="p-4">
						<h3 class="text-sm font-bold tracking-tight text-muted-foreground uppercase">
							Available Currencies
						</h3>
					</div>
					<div class="flex-1 overflow-y-auto px-4 pb-4">
						{#if currenciesQuery.isPending}
							<div class="flex h-32 items-center justify-center">
								<Loader2 class="h-6 w-6 animate-spin text-muted-foreground/40" />
							</div>
						{:else if currencies.length === 0}
							<div class="flex h-32 flex-col items-center justify-center text-center">
								<Globe class="mb-2 h-8 w-8 text-muted-foreground/20" />
								<p class="text-xs text-muted-foreground">No currencies yet.</p>
							</div>
						{:else}
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head class="h-8 text-[10px] uppercase">Code</Table.Head>
										<Table.Head class="h-8 text-[10px] uppercase">Name</Table.Head>
										<Table.Head class="h-8 text-right text-[10px] uppercase">Sym</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each currencies as currency}
										<Table.Row class="group">
											<Table.Cell class="py-2 font-mono text-xs font-bold"
												>{currency.code}</Table.Cell
											>
											<Table.Cell class="py-2 text-xs">{currency.name}</Table.Cell>
											<Table.Cell class="py-2 text-right font-bold text-primary"
												>{currency.symbol}</Table.Cell
											>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						{/if}
					</div>
				</div>

				<!-- Form side -->
				<div class="flex flex-col p-6">
					<div class="mb-6">
						<h3 class="text-lg font-bold tracking-tight">Add New</h3>
						<p class="text-xs text-muted-foreground">Create a new currency for your accounts.</p>
					</div>

					<form
						method="POST"
						action="?/createCurrency"
						use:enhance={() => {
							isLoading = true;
							return async ({ result }) => {
								isLoading = false;
								if (result.type === 'success') {
									toast.success('Currency created successfully');
									queryClient.invalidateQueries({ queryKey: ['currencies'] });
									resetForm();
								} else if (result.type === 'failure') {
									const errorMessage =
										typeof result.data?.error === 'string'
											? result.data.error
											: 'Failed to create currency';
									toast.error(errorMessage);
								}
							};
						}}
						class="space-y-4"
					>
						<div class="space-y-2">
							<Label
								for="code"
								class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>Currency Code</Label
							>
							<div class="relative">
								<Globe
									class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
								/>
								<Input
									id="code"
									name="code"
									placeholder="USD, EUR, GBP..."
									bind:value={code}
									class="pl-9 text-xs font-bold uppercase"
									maxlength={3}
									required
								/>
							</div>
						</div>

						<div class="space-y-2">
							<Label
								for="name"
								class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>Full Name</Label
							>
							<div class="relative">
								<Type
									class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
								/>
								<Input
									id="name"
									name="name"
									placeholder="US Dollar..."
									bind:value={name}
									class="pl-9 text-xs"
									required
								/>
							</div>
						</div>

						<div class="space-y-2">
							<Label
								for="symbol"
								class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>Symbol</Label
							>
							<div class="relative">
								<Tag
									class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
								/>
								<Input
									id="symbol"
									name="symbol"
									placeholder="$, €, £..."
									bind:value={symbol}
									class="pl-9 text-xs font-bold"
									required
								/>
							</div>
						</div>

						<div class="pt-4">
							<Button type="submit" class="w-full" disabled={isLoading}>
								{#if isLoading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{:else}
									<Plus class="mr-2 h-4 w-4" />
								{/if}
								Add Currency
							</Button>
						</div>
					</form>
				</div>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
