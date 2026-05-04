import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	// Prefetch all the data needed for the dashboard
	await Promise.all([
		queryClient.prefetchQuery({
			queryKey: ['accounts'],
			queryFn: async () => (await fetch('/api/accounts')).json()
		}),
		queryClient.prefetchQuery({
			queryKey: ['transactions'],
			queryFn: async () => (await fetch('/api/transactions')).json()
		})
	]);
};
