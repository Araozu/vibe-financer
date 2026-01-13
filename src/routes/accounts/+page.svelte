<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import CreateAccountDialog from "$lib/components/account/create-account-dialog.svelte";
	import { 
		CreditCard, 
		TrendingUp, 
		TrendingDown, 
		Coins,
		Plus,
		ChevronLeft,
		MoreHorizontal,
		ArrowUpRight,
		ArrowDownLeft,
		Wallet
	} from "@lucide/svelte";

	let { data } = $props();

	const typeIcons = {
		asset: CreditCard,
		expense: TrendingDown,
		revenue: TrendingUp,
		liability: Coins
	};

	const typeLabels = {
		asset: "Asset",
		expense: "Expense",
		revenue: "Revenue",
		liability: "Liability"
	};

    function formatAmount(amount: number, currencyCode: string, currencySymbol: string) {
        return (amount / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: currencyCode,
        });
    }
</script>

<div class="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
	<!-- Header -->
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
		<div class="flex items-center gap-4">
			<a href="/" class="p-2 hover:bg-muted rounded-full transition-colors">
				<ChevronLeft class="h-5 w-5" />
			</a>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Accounts</h1>
				<p class="text-muted-foreground">Manage your financial accounts and balances.</p>
			</div>
		</div>
		<div class="flex gap-2">
			<CreateAccountDialog />
		</div>
	</div>

	{#if data.accounts.length === 0}
		<Card.Root class="border-dashed flex flex-col items-center justify-center p-12 text-center">
			<div class="p-4 bg-muted rounded-full mb-4">
				<Wallet class="h-10 w-10 text-muted-foreground/40" />
			</div>
			<Card.Title class="text-xl">No accounts yet</Card.Title>
			<Card.Description class="max-w-xs mx-auto mt-2">
				Create your first account to start tracking your finances and transactions.
			</Card.Description>
			<div class="mt-6">
				<CreateAccountDialog />
			</div>
		</Card.Root>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.accounts as account}
				{@const Icon = typeIcons[account.type] || Wallet}
				<Card.Root class="overflow-hidden group hover:border-primary/50 transition-all">
					<Card.Header class="pb-2">
						<div class="flex justify-between items-start">
							<div 
								class="p-2 rounded-lg" 
								style="background-color: {account.color}20; color: {account.color}"
							>
								<Icon class="h-5 w-5" />
							</div>
							<Badge variant="secondary" class="text-[10px] uppercase font-bold tracking-wider">
								{typeLabels[account.type]}
							</Badge>
						</div>
						<div class="mt-4">
							<Card.Title class="text-xl group-hover:text-primary transition-colors">{account.name}</Card.Title>
							<Card.Description class="line-clamp-1">{account.description || 'No description'}</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						<div class="mt-2">
							<div class="text-3xl font-bold tracking-tight">
								{formatAmount(account.currentBalance, account.currencyCode, account.currencySymbol)}
							</div>
							<p class="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                {#if account.currentBalance >= account.initialBalance}
                                    <ArrowUpRight class="h-3 w-3 text-emerald-500" />
                                    <span class="text-emerald-500 font-medium">
                                        +{formatAmount(account.currentBalance - account.initialBalance, account.currencyCode, account.currencySymbol)}
                                    </span>
                                {:else}
                                    <ArrowDownLeft class="h-3 w-3 text-rose-500" />
                                    <span class="text-rose-500 font-medium">
                                        -{formatAmount(account.initialBalance - account.currentBalance, account.currencyCode, account.currencySymbol)}
                                    </span>
                                {/if}
                                <span class="opacity-70">from initial</span>
							</p>
						</div>
					</Card.Content>
                    <Card.Footer class="bg-muted/30 border-t border-border/40 py-3 flex justify-between">
                        <div class="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                            {account.currencyCode} • {account.currencySymbol}
                        </div>
                        <Button variant="ghost" size="icon" class="h-7 w-7">
                            <MoreHorizontal class="h-4 w-4" />
                        </Button>
                    </Card.Footer>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
