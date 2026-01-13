<script lang="ts">
    import { Toaster } from "$lib/components/ui/sonner/index.js";
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
    import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher />
<Toaster />

{@render children()}
