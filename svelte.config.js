import adapter from "svelte-adapter-bun"; 
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: { 
		adapter: adapter(),
		serviceWorker: {
			register: false // We'll register it manually for more control
		}
	}
};

export default config;
