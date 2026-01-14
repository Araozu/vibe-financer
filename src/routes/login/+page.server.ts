import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { login } from '$lib/application/auth/login';
import { signup } from '$lib/application/auth/signup';

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required' });
		}

		const result = await login({ email, password });

		if (!result.success) {
			return fail(400, { error: result.error });
		}

		// Set session cookie
		cookies.set('session', result.sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		throw redirect(302, '/');
	},

	signup: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!email || !password || !confirmPassword) {
			return fail(400, { error: 'All fields are required' });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match' });
		}

		const result = await signup({ email, password });

		if (!result.success) {
			return fail(400, { error: result.error });
		}

		// Auto-login after signup
		const loginResult = await login({ email, password });
		
		if (!loginResult.success) {
			return fail(500, { error: 'Account created but login failed. Please try logging in.' });
		}

		// Set session cookie
		cookies.set('session', loginResult.sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		throw redirect(302, '/');
	}
};
