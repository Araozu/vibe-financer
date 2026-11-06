import { accountRepo } from '$lib/infra/repos/account.repo';
import { userRepo } from '$lib/infra/repos/user.repo';
import { listTransactionsForMonthForAccounts } from '../transaction/list-transactions';
import { calculateAccountBalanceDelta } from '$lib/domain/transaction';
import { endOfMonth, startOfMonth } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export interface DashboardSummary {
	defaultAccountId: string | null;
	/** Default account balance as of now (excludes future-dated transactions). */
	currentBalance: number;
	/** Default account balance at end of the selected month (includes upcoming). */
	projectedBalance: number;
	/** Default account income/expenses within the selected month up to now. */
	income: number;
	expenses: number;
	/** As-of-now balances for every account, keyed by account id. */
	accountBalances: Record<string, number>;
	asOf: Date;
}

/**
 * Single source of truth for dashboard balances, used by the web dashboard
 * and the Android app. Clients must not recompute these locally.
 */
export async function getDashboardSummary(
	userId: string,
	month: number,
	year: number,
	timezone: string
): Promise<DashboardSummary> {
	const empty: DashboardSummary = {
		defaultAccountId: null,
		currentBalance: 0,
		projectedBalance: 0,
		income: 0,
		expenses: 0,
		accountBalances: {},
		asOf: new Date()
	};

	const [user, accounts] = await Promise.all([
		userRepo.findById(userId),
		accountRepo.findByUserId(userId)
	]);
	if (accounts.length === 0) return empty;

	const defaultAccountId =
		user?.defaultAccountId != null && accounts.some((a) => a.id === user.defaultAccountId)
			? user.defaultAccountId
			: null;

	// Month range in the user's timezone (same boundaries as the transactions endpoint).
	const dateInTz = new Date(year, month, 1);
	const monthStartUtc = fromZonedTime(startOfMonth(dateInTz), timezone);
	const monthEndUtc = fromZonedTime(endOfMonth(dateInTz), timezone);

	const now = new Date();
	const zonedNow = toZonedTime(now, timezone);
	const isCurrentMonth = zonedNow.getFullYear() === year && zonedNow.getMonth() === month;
	const effectiveEnd = isCurrentMonth ? now : monthEndUtc;

	const { transactions, initialBalances } = await listTransactionsForMonthForAccounts(
		accounts.map((a) => a.id),
		month,
		year,
		timezone
	);

	// Opening balance for accounts created mid-month (initialBalances only
	// includes the opening balance when created before the month start).
	const openingAt = (accountId: string, at: Date): number => {
		const account = accounts.find((a) => a.id === accountId);
		if (!account) return 0;
		return account.createdAt > monthStartUtc && account.createdAt <= at
			? account.initialBalance
			: 0;
	};

	const balanceAt = (accountId: string, at: Date): number => {
		let balance = (initialBalances[accountId] ?? 0) + openingAt(accountId, at);
		for (const tx of transactions) {
			if (tx.createdAt <= at) {
				balance += calculateAccountBalanceDelta(tx, accountId);
			}
		}
		return balance;
	};

	const accountBalances: Record<string, number> = {};
	for (const account of accounts) {
		accountBalances[account.id] = balanceAt(account.id, effectiveEnd);
	}

	if (defaultAccountId == null) {
		return { ...empty, accountBalances, asOf: now };
	}

	let projected = (initialBalances[defaultAccountId] ?? 0) + openingAt(defaultAccountId, monthEndUtc);
	let income = 0;
	let expenses = 0;
	for (const tx of transactions) {
		if (tx.createdAt <= monthEndUtc) {
			projected += calculateAccountBalanceDelta(tx, defaultAccountId);
		}
		if (tx.createdAt >= monthStartUtc && tx.createdAt <= effectiveEnd) {
			if (tx.type === 'income' && tx.accountId === defaultAccountId) {
				income += tx.amount;
			} else if (tx.type === 'expense' && tx.accountId === defaultAccountId) {
				expenses += tx.amount;
			}
		}
	}

	return {
		defaultAccountId,
		currentBalance: accountBalances[defaultAccountId] ?? 0,
		projectedBalance: projected,
		income,
		expenses,
		accountBalances,
		asOf: now
	};
}
