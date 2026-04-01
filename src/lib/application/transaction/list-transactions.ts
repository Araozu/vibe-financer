import { transactionRepo } from '$lib/infra/repos/transaction.repo';
import type { Transaction, TransactionType } from '$lib/domain/transaction';
import { startOfMonth, endOfMonth } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export type TransactionTimeframe =
	| 'all'
	| '7d'
	| '30d'
	| '90d'
	| 'this-month'
	| 'last-month'
	| 'this-year';

export interface TransactionListFilters {
	search?: string;
	category?: string;
	type?: TransactionType | 'all';
	timeframe?: TransactionTimeframe;
}

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

export async function listTransactionsForMonthForAccounts(
	accountIds: string[],
	month: number,
	year: number,
	timezone: string,
	limit?: number
): Promise<{ transactions: Transaction[]; initialBalances: Record<string, number> }> {
	// 1. Calculate the start and end of the month in the target timezone
	const dateInTz = new Date(year, month, 1);
	const monthStartLocal = startOfMonth(dateInTz);
	const monthEndLocal = endOfMonth(dateInTz);

	// 2. Convert these local times to UTC for the database query
	const monthStartUtc = fromZonedTime(monthStartLocal, timezone);
	const monthEndUtc = fromZonedTime(monthEndLocal, timezone);

	// 3. Fetch transactions within this UTC range for all accounts
	const transactions = await transactionRepo.findByAccountIdsAndDateRange(
		accountIds,
		monthStartUtc,
		monthEndUtc,
		limit
	);

	// 4. Calculate initial balances for each account
	const balances = await Promise.all(
		accountIds.map(async (accountId) => {
			const balance = await transactionRepo.getSumBeforeDate(accountId, monthStartUtc);
			return { accountId, balance };
		})
	);

	const initialBalances = balances.reduce(
		(acc, { accountId, balance }) => {
			acc[accountId] = balance;
			return acc;
		},
		{} as Record<string, number>
	);

	return {
		transactions,
		initialBalances
	};
}

export async function listTransactionsByAccountPaginated(
	accountId: string,
	limit: number,
	offset: number,
	filters?: TransactionListFilters
): Promise<Transaction[]> {
	const normalizedSearch = filters?.search?.trim();
	const normalizedCategory = filters?.category?.trim();
	const normalizedType = filters?.type && filters.type !== 'all' ? filters.type : undefined;
	const dateRange = getDateRangeForTimeframe(filters?.timeframe ?? 'all');

	if (
		!normalizedSearch &&
		!normalizedCategory &&
		!normalizedType &&
		!dateRange.startDate &&
		!dateRange.endDate
	) {
		return await transactionRepo.findByAccountIdPaginated(accountId, limit, offset);
	}

	return await transactionRepo.findByAccountIdPaginatedFiltered(accountId, limit, offset, {
		search: normalizedSearch,
		category: normalizedCategory,
		type: normalizedType,
		startDate: dateRange.startDate,
		endDate: dateRange.endDate
	});
}

export async function listTransactionCategoriesByAccount(accountId: string): Promise<string[]> {
	return await transactionRepo.findCategoriesByAccountId(accountId);
}

function getDateRangeForTimeframe(timeframe: TransactionTimeframe): {
	startDate?: Date;
	endDate?: Date;
} {
	const now = new Date();

	// Compute today's start/end in UTC to avoid server-local timezone shifts.
	const utcTodayStart = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	);
	const utcTodayEnd = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
	);

	switch (timeframe) {
		case '7d': {
			// Last 7 days in UTC (today and the previous 6 days).
			const start = new Date(utcTodayStart);
			start.setUTCDate(start.getUTCDate() - 6);
			return { startDate: start, endDate: utcTodayEnd };
		}
		case '30d': {
			// Last 30 days in UTC (today and the previous 29 days).
			const start = new Date(utcTodayStart);
			start.setUTCDate(start.getUTCDate() - 29);
			return { startDate: start, endDate: utcTodayEnd };
		}
		case '90d': {
			// Last 90 days in UTC (today and the previous 89 days).
			const start = new Date(utcTodayStart);
			start.setUTCDate(start.getUTCDate() - 89);
			return { startDate: start, endDate: utcTodayEnd };
		}
		case 'this-month': {
			// From the first day of this month (UTC) through the end of today (UTC).
			const startOfThisMonthUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
			return { startDate: startOfThisMonthUtc, endDate: utcTodayEnd };
		}
		case 'last-month': {
			// Entire previous calendar month in UTC.
			const year = now.getUTCFullYear();
			const month = now.getUTCMonth();
			const startOfLastMonthUtc = new Date(Date.UTC(year, month - 1, 1));
			const endOfLastMonthUtc = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
			return { startDate: startOfLastMonthUtc, endDate: endOfLastMonthUtc };
		}
		case 'this-year': {
			// From the first day of this year (UTC) through the end of today (UTC).
			const startOfThisYearUtc = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
			return { startDate: startOfThisYearUtc, endDate: utcTodayEnd };
		}
		default:
			return {};
	}
}
