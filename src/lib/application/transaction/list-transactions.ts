import { transactionRepo } from '$lib/infra/repos/transaction.repo';
import type { Transaction } from '$lib/domain/transaction';
import { startOfMonth, endOfMonth } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export async function listTransactions(): Promise<Transaction[]> {
	return await transactionRepo.findAll();
}

export async function listTransactionsByAccount(accountId: string): Promise<Transaction[]> {
	return await transactionRepo.findByAccountId(accountId);
}

export async function listTransactionsForMonth(
	accountId: string,
	month: number,
	year: number,
	timezone: string
): Promise<{ transactions: Transaction[]; initialBalance: number }> {
	// 1. Calculate the start and end of the month in the target timezone
	const dateInTz = new Date(year, month, 1);
	const monthStartLocal = startOfMonth(dateInTz);
	const monthEndLocal = endOfMonth(dateInTz);

	// 2. Convert these local times to UTC for the database query
	const monthStartUtc = fromZonedTime(monthStartLocal, timezone);
	const monthEndUtc = fromZonedTime(monthEndLocal, timezone);

	// 3. Fetch transactions within this UTC range
	const transactions = await transactionRepo.findByDateRange(accountId, monthStartUtc, monthEndUtc);

	// 4. Calculate initial balance (sum of all transactions before monthStartUtc)
	const balanceBefore = await transactionRepo.getSumBeforeDate(accountId, monthStartUtc);

	return {
		transactions,
		initialBalance: balanceBefore
	};
}

export async function listTransactionsByAccountPaginated(
	accountId: string,
	limit: number,
	offset: number
): Promise<Transaction[]> {
	return await transactionRepo.findByAccountIdPaginated(accountId, limit, offset);
}
