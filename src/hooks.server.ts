import { validateSession } from '$lib/application/auth/validate-session';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get('session');

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await validateSession(sessionToken);

	if (session && user) {
		event.locals.session = session;
		event.locals.user = user;
		event.cookies.set('session', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			expires: session.expiresAt
		});
	} else {
		event.locals.session = null;
		event.locals.user = null;
		event.cookies.delete('session', { path: '/' });
	}

	return resolve(event);
};
