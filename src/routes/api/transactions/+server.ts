import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAccountsByUser } from '$lib/application/account/list-accounts';
import { listTransactionsByAccountIds } from '$lib/application/transaction/list-transactions';
import { listTransactionsForMonthForAccounts } from '$lib/application/transaction/list-transactions';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');
	const limitParam = url.searchParams.get('limit');
	const timezone = url.searchParams.get('tz') ?? 'UTC';

	const accounts = await listAccountsByUser(locals.user.id);
	const accountIds = accounts.map((acc) => acc.id);

	if (monthParam !== null && yearParam !== null) {
		const month = parseInt(monthParam);
		const year = parseInt(yearParam);
		const limit = limitParam ? parseInt(limitParam) : undefined;

		if (!Number.isFinite(month) || !Number.isFinite(year)) {
			return json({ error: 'Invalid month or year' }, { status: 400 });
		}
		if (limit !== undefined && !Number.isFinite(limit)) {
			return json({ error: 'Invalid limit' }, { status: 400 });
		}

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

	const transactions = await listTransactionsByAccountIds(accountIds);

	const serializedTransactions = transactions.map((tx) => ({
		...tx,
		createdAt: tx.createdAt.toISOString(),
		updatedAt: tx.updatedAt.toISOString()
	}));

	return json(serializedTransactions);
};
