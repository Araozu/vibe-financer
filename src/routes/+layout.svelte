<script lang="ts">
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';
	import Header from '$lib/components/layout/header.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';
	import { setDashboardPeriodContext } from '$lib/components/layout/dashboard-period.js';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	const isAuthRoute = $derived(page.route.id?.startsWith('/(auth)') ?? false);
	const dashboardNow = new Date();
	const dashboardPeriod = $state({
		month: dashboardNow.getMonth(),
		year: dashboardNow.getFullYear(),
		currentMonth: dashboardNow.getMonth(),
		currentYear: dashboardNow.getFullYear()
	});

	setDashboardPeriodContext(dashboardPeriod);

	// Register service worker for PWA support
	onMount(() => {
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch((error) => {
				console.error('Service worker registration failed:', error);
			});
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher />
<Toaster />

<QueryClientProvider client={data.queryClient}>
	{#if !isAuthRoute}
		<div>
			<div class="mx-auto max-w-7xl px-4 md:px-8">
				<Header />
			</div>
		</div>
	{/if}
	<div class="mx-auto max-w-7xl px-4 pt-4 pb-4 md:px-8 md:pb-8">
		{@render children()}
	</div>
	<SvelteQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
