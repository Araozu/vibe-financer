<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import { ChevronsUpDown, Loader2, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	export type BudgetOption = {
		id: string;
		category: string;
		currencyId: string;
	};

	let {
		budgets = [],
		currencyId,
		value = $bindable(''),
		budgetId = $bindable<string | null>(null),
		onBudgetCreated,
		disabled = false
	}: {
		budgets: BudgetOption[];
		currencyId: string;
		value?: string;
		budgetId?: string | null;
		onBudgetCreated?: () => void | Promise<void>;
		disabled?: boolean;
	} = $props();

	let open = $state(false);
	let commandSearch = $state('');
	let creating = $state(false);

	function selectBudget(b: BudgetOption) {
		value = b.category;
		budgetId = b.id;
		open = false;
	}

	async function createCategory() {
		const cat = commandSearch.trim();
		if (!cat) return;
		if (!currencyId) {
			toast.error('Select an account first');
			return;
		}
		creating = true;
		try {
			const res = await fetch('/api/budgets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					category: cat,
					limit: 0,
					currencyId,
					period: 'monthly',
					startDate: new Date().toISOString()
				})
			});
			const data = (await res.json()) as { id?: string; category?: string; error?: string };
			if (!res.ok) {
				throw new Error(data.error ?? 'Failed to create budget');
			}
			value = data.category ?? cat;
			budgetId = data.id ?? null;
			open = false;
			await onBudgetCreated?.();
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to create budget';
			toast.error(message);
		} finally {
			creating = false;
		}
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		type="button"
		{disabled}
		class={cn(
			buttonVariants({ variant: 'outline', size: 'sm' }),
			'h-8 min-w-[7rem] justify-between border-none bg-transparent px-2 text-xs font-medium shadow-none hover:bg-accent/40'
		)}
	>
		<span class="truncate text-left">{value ? value : 'Category…'}</span>
		<ChevronsUpDown class="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
	</Popover.Trigger>
	<Popover.Content class="w-[min(100vw-2rem,280px)] p-0" align="start">
		<Command.Root
			shouldFilter={true}
			onStateChange={(s) => {
				commandSearch = s.search;
			}}
		>
			<Command.Input placeholder="Search category…" class="h-9" />
			<Command.List class="max-h-60">
				<Command.Empty>
					{#if commandSearch.trim()}
						<div class="px-2 pb-2">
							<Button
								type="button"
								variant="secondary"
								class="w-full gap-2"
								disabled={creating}
								onclick={createCategory}
							>
								{#if creating}
									<Loader2 class="h-4 w-4 animate-spin" />
								{:else}
									<Plus class="h-4 w-4" />
								{/if}
								Create “{commandSearch.trim()}”
							</Button>
						</div>
					{:else}
						<p class="px-2 text-xs text-muted-foreground">Type to filter or create a category.</p>
					{/if}
				</Command.Empty>
				<Command.Group>
					{#each budgets as b (b.id)}
						<Command.Item value={b.id} keywords={[b.category]} onSelect={() => selectBudget(b)}>
							{b.category}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
