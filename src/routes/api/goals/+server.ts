import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setGoal, removeGoal } from '$lib/application/account/set-goal';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const data = await request.json();
	const { accountId, name, targetAmount, targetDate } = data;

	if (!accountId || !name || !targetAmount) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	try {
		const goal = await setGoal(locals.user.id, {
			accountId,
			name,
			targetAmount,
			targetDate: targetDate ? new Date(targetDate) : null
		});
		return json(goal);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const accountId = url.searchParams.get('accountId');
	if (!accountId) {
		return json({ error: 'Missing accountId' }, { status: 400 });
	}

	try {
		await removeGoal(locals.user.id, accountId);
		return json({ success: true });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 400 });
	}
};
