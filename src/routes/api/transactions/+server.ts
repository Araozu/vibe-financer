import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAccounts } from '$lib/application/account/list-accounts';
import { listTransactions } from '$lib/application/transaction/list-transactions';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const allAccounts = await listAccounts();
	const allTransactions = await listTransactions();

	// Filter accounts by user
	const accounts = allAccounts.filter(acc => acc.userId === locals.user!.id);

	// Filter transactions by user's accounts
	const accountIds = new Set(accounts.map(acc => acc.id));
	const transactions = allTransactions.filter(tx => accountIds.has(tx.accountId));

	// Serialize dates for JSON
	const serializedTransactions = transactions.map(tx => ({
		...tx,
		createdAt: tx.createdAt.toISOString(),
		updatedAt: tx.updatedAt.toISOString(),
	}));

	return json(serializedTransactions);
};
