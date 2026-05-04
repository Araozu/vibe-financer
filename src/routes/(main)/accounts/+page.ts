import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	// Prefetch detailed accounts data
	await queryClient.prefetchQuery({
		queryKey: ['accounts', 'detailed'],
		queryFn: async () => (await fetch('/api/accounts/detailed')).json()
	});
};
