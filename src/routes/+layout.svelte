<script lang="ts">
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from "$lib/components/ui/sonner/index.js";
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher />
<Toaster />

<QueryClientProvider client={data.queryClient}>
	{@render children()}
</QueryClientProvider>
