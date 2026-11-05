import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { login } from '$lib/application/auth/login';

/**
 * POST /api/auth/login
 *
 * JSON login for native clients. Body: { email, password }.
 * On success sets the `session` cookie (same as web login) and also
 * returns the token in the body so clients without cookie jars can
 * send it back as `Cookie: session=...`.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	let body: { email?: unknown; password?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const email = typeof body.email === 'string' ? body.email : '';
	const password = typeof body.password === 'string' ? body.password : '';

	if (!email || !password) {
		return json({ error: 'Email and password are required' }, { status: 400 });
	}

	const result = await login({ email, password });

	if (!result.success) {
		return json({ error: result.error }, { status: 401 });
	}

	cookies.set('session', result.sessionToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});

	return json({ sessionToken: result.sessionToken });
};
