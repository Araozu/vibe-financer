import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAccounts } from '$lib/application/account/list-accounts';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const allAccounts = await listAccounts();
	// Filter accounts by user
	const accounts = allAccounts.filter((acc) => acc.userId === locals.user!.id);

	// Serialize dates for JSON
	const serializedAccounts = accounts.map((acc) => ({
		...acc,
		createdAt: acc.createdAt.toISOString(),
		updatedAt: acc.updatedAt.toISOString()
	}));

	return json(serializedAccounts);
};
