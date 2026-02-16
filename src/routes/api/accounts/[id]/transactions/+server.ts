import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTransactionsByAccountPaginated } from '$lib/application/transaction/list-transactions';
import { getAccountState } from '$lib/application/account/list-accounts';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const accountId = params.id;
	const limit = Number(url.searchParams.get('limit')) || 50;
	const offset = Number(url.searchParams.get('offset')) || 0;

	// Verify account belongs to user
	const account = await getAccountState(accountId);
	if (!account || account.userId !== locals.user.id) {
		return json({ error: 'Account not found' }, { status: 404 });
	}

	const transactions = await listTransactionsByAccountPaginated(accountId, limit, offset);

	return json({
		transactions: transactions.map((tx) => ({
			...tx,
			createdAt: tx.createdAt.toISOString(),
			updatedAt: tx.updatedAt.toISOString()
		})),
		limit,
		offset,
		hasMore: transactions.length === limit
	});
};
