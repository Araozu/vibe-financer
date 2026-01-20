<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { Plus } from "@lucide/svelte";
	import CreateTransactionForm from "./create-transaction-form.svelte";
	import { cn } from "$lib/utils.js";

	// Minimal account type for what this component needs
	interface AccountLike {
		id: string;
		name: string;
		color: string;
		currencyCode: string;
	}

	let { open = $bindable(false), accounts = [] } = $props<{ open?: boolean, accounts: AccountLike[] }>();

	const hasAccounts = $derived(accounts.length > 0);

	function handleSuccess(createMore: boolean) {
		if (!createMore) {
			open = false;
		}
	}
</script>

<Dialog.Root bind:open>
	{#if hasAccounts}
		<Dialog.Trigger class={cn(buttonVariants({ size: 'sm' }))}>
			<Plus class="mr-2 h-4 w-4" />
			Add Transaction
		</Dialog.Trigger>
	{:else}
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger class={cn(buttonVariants({ size: 'sm' }))} disabled>
					<Plus class="mr-2 h-4 w-4" />
					Add Transaction
				</Tooltip.Trigger>
				<Tooltip.Content>
					<p>You need to create an account first</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/if}
	<Dialog.Content class="sm:max-w-2xl p-0 overflow-hidden shadow-2xl">
		<CreateTransactionForm {accounts} onSuccess={handleSuccess} />
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.sm\:max-w-2xl) {
		max-width: 42rem;
	}
</style>
