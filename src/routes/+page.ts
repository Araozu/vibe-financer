import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	// Check if user is authenticated
	const userResponse = await fetch('/api/user');
	if (!userResponse.ok) {
		throw redirect(302, '/login');
	}

	// Prefetch all the data needed for the dashboard
	await Promise.all([
		queryClient.prefetchQuery({
			queryKey: ['user'],
			queryFn: async () => (await fetch('/api/user')).json(),
		}),
		queryClient.prefetchQuery({
			queryKey: ['accounts'],
			queryFn: async () => (await fetch('/api/accounts')).json(),
		}),
		queryClient.prefetchQuery({
			queryKey: ['transactions'],
			queryFn: async () => (await fetch('/api/transactions')).json(),
		}),
	]);
};
