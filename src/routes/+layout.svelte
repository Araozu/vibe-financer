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

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	const isAuthRoute = $derived(page.route.id?.startsWith('/(auth)') ?? false);

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
	<div class="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
		{#if !isAuthRoute}
			<Header />
		{/if}
		{@render children()}
	</div>
	<SvelteQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
