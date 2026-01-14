import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	// Check if user is already logged in
	const userResponse = await fetch('/api/user');
	if (userResponse.ok) {
		throw redirect(302, '/');
	}
	return {};
};
