import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAccounts } from '$lib/application/account/list-accounts';
import {
	listTransactions,
	listTransactionsForMonth
} from '$lib/application/transaction/list-transactions';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');
	const timezone = url.searchParams.get('tz') ?? 'UTC';

	const allAccounts = await listAccounts();
	const accounts = allAccounts.filter((acc) => acc.userId === locals.user!.id);
	const accountIds = new Set(accounts.map((acc) => acc.id));

	if (monthParam !== null && yearParam !== null) {
		const month = parseInt(monthParam);
		const year = parseInt(yearParam);

		const resultByAccount = await Promise.all(
			Array.from(accountIds).map(async (accountId) => {
				const { transactions, initialBalance } = await listTransactionsForMonth(
					accountId,
					month,
					year,
					timezone
				);
				return { accountId, transactions, initialBalance };
			})
		);

		// Flatten transactions and keep initial balances
		const allTransactions = resultByAccount.flatMap((r) => r.transactions);
		const initialBalances = resultByAccount.reduce(
			(acc, r) => {
				acc[r.accountId] = r.initialBalance;
				return acc;
			},
			{} as Record<string, number>
		);

		return json({
			transactions: allTransactions.map((tx) => ({
				...tx,
				createdAt: tx.createdAt.toISOString(),
				updatedAt: tx.updatedAt.toISOString()
			})),
			initialBalances
		});
	}

	const allTransactions = await listTransactions();
	const transactions = allTransactions.filter((tx) => accountIds.has(tx.accountId));

	const serializedTransactions = transactions.map((tx) => ({
		...tx,
		createdAt: tx.createdAt.toISOString(),
		updatedAt: tx.updatedAt.toISOString()
	}));

	return json(serializedTransactions);
};
