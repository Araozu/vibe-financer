<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { ArrowRightLeft } from "@lucide/svelte";
	import type { Account } from "$lib/domain/account";
	import CreateTransferForm from "./create-transfer-form.svelte";

	let { open = $bindable(false), accounts = [] } = $props<{ open?: boolean, accounts: Account[] }>();

	function handleSuccess(createMore: boolean) {
		if (!createMore) {
			open = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		<Button variant="outline" size="sm">
			<ArrowRightLeft class="mr-2 h-4 w-4" />
			Transfer
		</Button>
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-2xl p-0 overflow-hidden shadow-2xl bg-background">
		<CreateTransferForm {accounts} onSuccess={handleSuccess} />
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.sm\:max-w-2xl) {
		max-width: 42rem;
	}
</style>
