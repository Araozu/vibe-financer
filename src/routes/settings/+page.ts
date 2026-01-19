import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	// Check if user is authenticated
	const userResponse = await fetch('/api/user');
	if (!userResponse.ok) {
		throw redirect(302, '/login');
	}

	// Prefetch user data
	await queryClient.prefetchQuery({
		queryKey: ['user'],
		queryFn: async () => (await fetch('/api/user')).json(),
	});
};
