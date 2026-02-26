import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAccounts } from '$lib/application/account/list-accounts';
import {
	listTransactions,
	listTransactionsForMonthForAccounts
} from '$lib/application/transaction/list-transactions';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');
	const limitParam = url.searchParams.get('limit');
	const timezone = url.searchParams.get('tz') ?? 'UTC';

	const allAccounts = await listAccounts();
	const accounts = allAccounts.filter((acc) => acc.userId === locals.user!.id);
	const accountIds = accounts.map((acc) => acc.id);

	if (monthParam !== null && yearParam !== null) {
		const month = parseInt(monthParam);
		const year = parseInt(yearParam);
		const limit = limitParam ? parseInt(limitParam) : undefined;

		const { transactions, initialBalances } = await listTransactionsForMonthForAccounts(
			accountIds,
			month,
			year,
			timezone,
			limit
		);

		return json({
			transactions: transactions.map((tx) => ({
				...tx,
				createdAt: tx.createdAt.toISOString(),
				updatedAt: tx.updatedAt.toISOString()
			})),
			initialBalances
		});
	}

	const allTransactions = await listTransactions();
	const accountIdSet = new Set(accountIds);
	const transactions = allTransactions.filter((tx) => accountIdSet.has(tx.accountId));

	const serializedTransactions = transactions.map((tx) => ({
		...tx,
		createdAt: tx.createdAt.toISOString(),
		updatedAt: tx.updatedAt.toISOString()
	}));

	return json(serializedTransactions);
};
