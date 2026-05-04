<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { Calendar, LogOut, Plus, Settings, User } from '@lucide/svelte';
	import logo from '$lib/assets/plain_icon.svg';
	import { cn } from '$lib/utils.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import CreateTransactionDialog from '$lib/components/transaction/create-transaction-dialog.svelte';
	import {
		DASHBOARD_MONTHS,
		createDashboardYears,
		getDashboardPeriodContext
	} from '$lib/components/layout/dashboard-period.js';

	type HeaderUser = {
		email: string;
		firstName: string | null;
		lastName: string | null;
	};

	type HeaderAccount = {
		id: string;
		name: string;
		color: string;
		currencyId: string;
		currencyCode: string;
	};

	const dashboardPeriod = getDashboardPeriodContext();
	const accountsQuery = createQuery<HeaderAccount[]>(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json()
	}));
	const userQuery = createQuery<HeaderUser>(() => ({
		queryKey: ['user'],
		queryFn: async () => (await fetch('/api/user')).json()
	}));

	const navItems = [
		{ label: 'Overview', href: '/' },
		{ label: 'Budgets', href: '/budgets' },
		{ label: 'Accounts', href: '/accounts' },
		{ label: 'Currencies', href: '/currencies' },
		{ label: 'Settings', href: '/settings' }
	];

	let accounts = $derived(accountsQuery.data ?? []);
	let user = $derived(userQuery.data);
	let isOverview = $derived(page.url.pathname === '/');
	let dashboardYears = $derived(createDashboardYears(dashboardPeriod.currentYear));
	let userLabel = $derived(
		[user?.firstName, user?.lastName].filter((part) => (part ?? '').trim().length > 0).join(' ')
	);
	let logoutForm: HTMLFormElement | null = null;
	let userInitials = $derived.by(() => {
		const namedInitials = userLabel
			.split(' ')
			.filter((part) => part.trim().length > 0)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.slice(0, 2)
			.join('');
		const emailInitials =
			user?.email
				?.split('@')[0]
				.split(/[._-]/)
				.filter((part) => part.trim().length > 0)
				.map((part) => part[0]?.toUpperCase() ?? '')
				.slice(0, 2)
				.join('') ?? '';

		if (namedInitials.length > 0) {
			return namedInitials.slice(0, 2);
		}

		if (emailInitials.length > 0) {
			return emailInitials.slice(0, 2);
		}

		return 'U';
	});

	function isActive(href: string) {
		if (href === '/') {
			return page.url.pathname === href;
		}

		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<header class="w-full border-b border-border/60">
	<div class="flex flex-col gap-4 py-4">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<a href="/" class="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80">
				<img src={logo} alt="Vibe Financer" class="h-8 w-8" />
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold tracking-tight text-foreground">Vibe Financer</p>
					<p class="truncate text-xs text-muted-foreground">Personal finance operating system</p>
				</div>
			</a>

			<div class="flex flex-wrap items-center justify-end gap-2">
				{#if isOverview}
					<div
						class="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 px-2 py-1 shadow-sm"
					>
						<Calendar class="ml-1 h-4 w-4 text-muted-foreground" />

						<Select.Root
							type="single"
							value={dashboardPeriod.month.toString()}
							onValueChange={(value) => (dashboardPeriod.month = parseInt(value))}
						>
							<Select.Trigger
								class="h-8 w-auto min-w-0 border-none bg-transparent px-2 text-sm font-medium shadow-none hover:bg-muted/60 focus:ring-0 focus:outline-none data-[placeholder]:text-foreground"
							>
								{DASHBOARD_MONTHS[dashboardPeriod.month]}
							</Select.Trigger>
							<Select.Content>
								{#each DASHBOARD_MONTHS as month, i (i)}
									<Select.Item value={i.toString()} label={month}>{month}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>

						<div class="mx-0.5 h-4 w-px bg-border"></div>

						<Select.Root
							type="single"
							value={dashboardPeriod.year.toString()}
							onValueChange={(value) => (dashboardPeriod.year = parseInt(value))}
						>
							<Select.Trigger
								class="h-8 w-auto border-none bg-transparent px-2 text-sm font-medium shadow-none hover:bg-muted/60 focus:ring-0 focus:outline-none data-[placeholder]:text-foreground"
							>
								{dashboardPeriod.year}
							</Select.Trigger>
							<Select.Content>
								{#each dashboardYears as year (year)}
									<Select.Item value={year.toString()} label={year.toString()}>{year}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					{#if dashboardPeriod.month !== dashboardPeriod.currentMonth || dashboardPeriod.year !== dashboardPeriod.currentYear}
						<button
							type="button"
							class={cn(
								buttonVariants({ variant: 'ghost', size: 'sm' }),
								'h-9 rounded-full px-3 text-[11px] font-semibold tracking-[0.18em] uppercase'
							)}
							onclick={() => {
								dashboardPeriod.month = dashboardPeriod.currentMonth;
								dashboardPeriod.year = dashboardPeriod.currentYear;
							}}
						>
							Today
						</button>
					{/if}
				{/if}

				<CreateTransactionDialog {accounts}>
					{#snippet trigger()}
						<div
							class={cn(
								buttonVariants({ variant: 'outline', size: 'sm' }),
								'h-9 rounded-full border-border/60 bg-foreground px-3 text-background shadow-none hover:bg-foreground/90 hover:text-background'
							)}
						>
							<Plus class="h-4 w-4" />
							<span class="hidden sm:inline">Add Transaction</span>
						</div>
					{/snippet}
				</CreateTransactionDialog>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class={cn(
							buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
							'h-9 w-9 rounded-full border border-border/60 bg-background shadow-none hover:bg-muted/60'
						)}
					>
						<span class="sr-only">Open user menu</span>
						<span class="text-xs font-semibold tracking-tight">{userInitials}</span>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56">
						<DropdownMenu.Label>
							<div class="flex flex-col gap-0.5">
								<span class="text-sm font-medium text-foreground">
									{userLabel.length > 0 ? userLabel : 'Account'}
								</span>
								<span class="text-xs font-normal text-muted-foreground">
									{user?.email ?? 'Signed in'}
								</span>
							</div>
						</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.Item onclick={() => (window.location.href = '/settings')}>
							<Settings class="h-4 w-4" />
							Settings
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => (window.location.href = '/settings')}>
							<User class="h-4 w-4" />
							Profile
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<form method="POST" action="/logout" bind:this={logoutForm}></form>
						<DropdownMenu.Item onclick={() => logoutForm?.requestSubmit()}>
							<LogOut class="h-4 w-4" />
							Log out
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>

		<nav class="overflow-x-auto">
			<div class="flex min-w-max items-center gap-1">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						aria-current={isActive(item.href) ? 'page' : undefined}
						class={cn(
							'inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors',
							isActive(item.href)
								? 'border-foreground text-foreground'
								: 'border-transparent text-muted-foreground hover:text-foreground'
						)}
					>
						{item.label}
					</a>
				{/each}
			</div>
		</nav>
	</div>
</header>
