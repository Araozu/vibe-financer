<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Plus } from "@lucide/svelte";
	import type { Account } from "$lib/domain/account";
	import CreateTransactionForm from "./create-transaction-form.svelte";

	let { open = $bindable(false), accounts = [] } = $props<{ open?: boolean, accounts: Account[] }>();

	function handleSuccess(createMore: boolean) {
		if (!createMore) {
			open = false;
		}
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
		<CreateTransactionForm {accounts} onSuccess={handleSuccess} />
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.sm\:max-w-2xl) {
		max-width: 42rem;
	}
</style>
