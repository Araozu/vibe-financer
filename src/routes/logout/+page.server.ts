import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { logout } from '$lib/application/auth/logout';

export const actions: Actions = {
	default: async ({ cookies }) => {
		const sessionToken = cookies.get('session');

		if (sessionToken) {
			await logout(sessionToken);
		}

		cookies.delete('session', { path: '/' });
		throw redirect(302, '/login');
	}
};
