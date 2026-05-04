import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	const userResponse = await fetch('/api/user');
	if (!userResponse.ok) {
		throw redirect(302, '/login');
	}

	const user = await userResponse.json();
	queryClient.setQueryData(['user'], user);

	return { user };
};
