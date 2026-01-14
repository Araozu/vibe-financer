<script lang="ts">
	import { page } from '$app/state';
	import { ChevronLeft } from "@lucide/svelte";
	import logo from "$lib/assets/plain_icon.svg";
	import * as NavigationMenu from "$lib/components/ui/navigation-menu/index.js";
	import { navigationMenuTriggerStyle } from "$lib/components/ui/navigation-menu/navigation-menu-trigger.svelte";
	import { createQuery } from '@tanstack/svelte-query';
	import CreateTransactionDialog from "$lib/components/transaction/create-transaction-dialog.svelte";

	const accountsQuery = createQuery(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json(),
	}));

	let accounts = $derived(accountsQuery.data ?? []);
	const isRoot = $derived(page.url.pathname === '/');
</script>

<div class="border-b pb-6 gap-4 w-full">
	<div class="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 w-full justify-between">
		<div class="flex items-center gap-4">
			<div class="w-12 h-12 flex items-center justify-center">
				{#if isRoot}
					<img src={logo} alt="Vibe Financer" class="h-12 w-12" />
				{:else}
					<button 
						onclick={() => history.back()} 
						class="p-2 hover:bg-muted rounded-full transition-colors flex items-center justify-center w-full h-full"
						aria-label="Go back"
					>
						<ChevronLeft class="h-8 w-8" />
					</button>
				{/if}
			</div>
			<div>
				<a href="/" class="hover:opacity-80 transition-opacity">
					<h1 class="text-3xl font-bold tracking-tight">Financer</h1>
				</a>
				<p class="text-muted-foreground text-sm">
					{#if isRoot}
						Diamond hands
					{:else if page.url.pathname.startsWith('/accounts')}
						Accounts
					{:else if page.url.pathname.startsWith('/settings')}
						Settings
					{:else}
						Vibe Financer
					{/if}
				</p>
			</div>
		</div>

		<div class="flex items-center gap-4 md:gap-8">
			<NavigationMenu.Root>
				<NavigationMenu.List>
					<NavigationMenu.Item>
						<a href="/">
							<NavigationMenu.Link class={navigationMenuTriggerStyle()}>
								Dashboard
							</NavigationMenu.Link>
						</a>
					</NavigationMenu.Item>
					<NavigationMenu.Item>
						<a href="/accounts">
							<NavigationMenu.Link class={navigationMenuTriggerStyle()}>
								Accounts
							</NavigationMenu.Link>
						</a>
					</NavigationMenu.Item>
					<NavigationMenu.Item>
						<a href="/settings">
							<NavigationMenu.Link class={navigationMenuTriggerStyle()}>
								Settings
							</NavigationMenu.Link>
						</a>
					</NavigationMenu.Item>
				</NavigationMenu.List>
			</NavigationMenu.Root>

			<div class="flex items-center gap-2">
				<CreateTransactionDialog {accounts} />
			</div>
		</div>
	</div>
</div>
