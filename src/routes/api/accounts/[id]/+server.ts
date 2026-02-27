import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { disableAccount } from '$lib/application/account/disable-account';

export const DELETE: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json().catch(() => null);
		const reason = body?.reason && typeof body.reason === 'string' ? body.reason : undefined;

		await disableAccount(params.id, locals.user.id, reason);
		return json({ success: true, message: 'Account disabled successfully' });
	} catch (error) {
		console.error('Error disabling account:', error);

		if (error && typeof error === 'object') {
			const e = error as { status?: number; message?: string; body?: { message?: string } };
			if (typeof e.status === 'number' && e.status >= 400 && e.status < 600) {
				return json(
					{ error: e.body?.message ?? e.message ?? 'Request failed' },
					{ status: e.status }
				);
			}
		}

		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
