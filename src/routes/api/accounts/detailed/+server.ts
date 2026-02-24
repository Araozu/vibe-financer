import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAccounts } from '$lib/application/account/list-accounts';
import { listTransactionsByAccount } from '$lib/application/transaction/list-transactions';
import { toUTC } from '$lib/domain/date-formatter';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');

	const now = toUTC(new Date());
	const targetMonth = monthParam ? parseInt(monthParam) : now.getUTCMonth();
	const targetYear = yearParam ? parseInt(yearParam) : now.getUTCFullYear();

	const allAccounts = await listAccounts();
	// Filter accounts by user
	const accounts = allAccounts.filter((acc) => acc.userId === locals.user!.id);

	const accountsWithData = await Promise.all(
		accounts.map(async (account) => {
			const transactions = await listTransactionsByAccount(account.id);

			// Target month range
			const firstDayOfMonth = toUTC(new Date(Date.UTC(targetYear, targetMonth, 1)));
			const lastDayOfMonth = toUTC(
				new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999))
			);

			// Filter transactions up to the end of the target month
			const transactionsUpToTarget = transactions.filter((t) => t.createdAt <= lastDayOfMonth);
			const sortedTransactionsAll = [...transactionsUpToTarget].sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime()
			);
			const last10Transactions = sortedTransactionsAll.slice(0, 10);

			const thisMonthTransactions = transactions.filter(
				(t) => t.createdAt >= firstDayOfMonth && t.createdAt <= lastDayOfMonth
			);

			// Calculate balance at the end of the target month
			// We can't just use account.currentBalance if we are looking at a past month
			// But if we are looking at a future month, we need to include future transactions

			// Let's get all transactions to calculate the balance at the end of the target month
			let balanceAtEndOfMonth = account.initialBalance;
			const allTransactionsSorted = [...transactions].sort(
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime()
			);

			for (const tx of allTransactionsSorted) {
				if (tx.createdAt <= lastDayOfMonth) {
					if (tx.type === 'income') {
						balanceAtEndOfMonth += tx.amount;
					} else {
						balanceAtEndOfMonth -= tx.amount;
					}
				} else {
					break;
				}
			}

			// Calculate daily balances
			const chartData = [];
			let runningBalance = balanceAtEndOfMonth;

			// Sort transactions for this month by date descending
			const sortedTransactions = [...thisMonthTransactions].sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime()
			);

			let txIndex = 0;
			for (
				let d = new Date(lastDayOfMonth);
				d >= firstDayOfMonth;
				d.setUTCDate(d.getUTCDate() - 1)
			) {
				const dayStart = toUTC(new Date(d));
				dayStart.setUTCHours(0, 0, 0, 0);
				const dayEnd = toUTC(new Date(d));
				dayEnd.setUTCHours(23, 59, 59, 999);

				chartData.unshift({
					date: toUTC(new Date(d)).toISOString(),
					balance: runningBalance / 100
				});

				while (
					txIndex < sortedTransactions.length &&
					sortedTransactions[txIndex].createdAt >= dayStart &&
					sortedTransactions[txIndex].createdAt <= dayEnd
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
				currentBalance: balanceAtEndOfMonth,
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
