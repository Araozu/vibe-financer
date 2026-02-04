import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAccounts } from '$lib/application/account/list-accounts';
import { listTransactionsByAccount } from '$lib/application/transaction/list-transactions';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const allAccounts = await listAccounts();
	// Filter accounts by user
	const accounts = allAccounts.filter((acc) => acc.userId === locals.user!.id);

	const accountsWithData = await Promise.all(
		accounts.map(async (account) => {
			const transactions = await listTransactionsByAccount(account.id);
			const last10Transactions = transactions.slice(0, 10);

			// Month to date chart data
			const now = new Date();
			const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

			// Filter transactions for this month
			const thisMonthTransactions = transactions.filter((t) => t.createdAt >= firstDayOfMonth);

			// Calculate daily balances
			// Start with current balance and work backwards to the beginning of the month
			const chartData = [];
			let runningBalance = account.currentBalance;

			// Sort transactions by date descending for easier backward calculation
			const sortedTransactions = [...thisMonthTransactions].sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime()
			);

			const today = new Date();
			today.setHours(23, 59, 59, 999);

			let txIndex = 0;
			for (let d = new Date(today); d >= firstDayOfMonth; d.setDate(d.getDate() - 1)) {
				const dayStart = new Date(d);
				dayStart.setHours(0, 0, 0, 0);

				// Balance at the END of this day is the runningBalance
				chartData.unshift({
					date: new Date(d).toISOString(),
					balance: runningBalance / 100
				});

				// Now adjust runningBalance by removing transactions that happened on this day
				// to get the balance at the start of this day (which is the end of previous day)
				while (
					txIndex < sortedTransactions.length &&
					sortedTransactions[txIndex].createdAt >= dayStart
				) {
					const tx = sortedTransactions[txIndex];
					if (tx.type === 'income') {
						runningBalance -= tx.amount;
					} else {
						runningBalance += tx.amount;
					}
					txIndex++;
				}
			}

			return {
				...account,
				createdAt: account.createdAt.toISOString(),
				updatedAt: account.updatedAt.toISOString(),
				last10Transactions: last10Transactions.map((tx) => ({
					...tx,
					createdAt: tx.createdAt.toISOString(),
					updatedAt: tx.updatedAt.toISOString()
				})),
				chartData
			};
		})
	);

	return json(accountsWithData);
};
