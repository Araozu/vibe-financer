/**
 * Balance History Application Service
 *
 * Provides queries for historical balance data using event sourcing.
 * This is the key benefit of event sourcing - time-travel queries!
 */

import {
	getAccountBalanceAsOf,
	getBalanceHistoryBetween,
	getNetWorthAsOf,
	getAllAccountBalancesAsOf,
	getAccountAuditTrail,
	getAccountWithHistory
} from '../account/account-projection';
import type { BalanceSnapshot } from '$lib/domain/account-aggregate';

export interface BalanceAtTime {
	accountId: string;
	accountName: string;
	balance: number;
	timestamp: Date;
}

export interface NetWorthSnapshot {
	timestamp: Date;
	totalBalance: number;
	accounts: Array<{
		accountId: string;
		name: string;
		balance: number;
	}>;
}

export interface AuditEntry {
	eventId: string;
	eventType: string;
	userId: string;
	occurredAt: Date;
	payload: unknown;
	metadata: Record<string, unknown> | null;
}

/**
 * Get the balance of an account at a specific point in time
 */
export async function getBalanceAt(accountId: string, asOf: Date): Promise<number | null> {
	return getAccountBalanceAsOf(accountId, asOf);
}

/**
 * Get balance history for an account within a date range
 */
export async function getBalanceHistory(
	accountId: string,
	startDate: Date,
	endDate: Date
): Promise<BalanceSnapshot[]> {
	return getBalanceHistoryBetween(accountId, startDate, endDate);
}

/**
 * Get the complete balance history for an account
 */
export async function getFullBalanceHistory(accountId: string): Promise<BalanceSnapshot[]> {
	const accountWithHistory = await getAccountWithHistory(accountId);
	return accountWithHistory?.balanceHistory ?? [];
}

/**
 * Get net worth at a specific point in time
 */
export async function getNetWorthAt(userId: string, asOf: Date): Promise<number> {
	return getNetWorthAsOf(userId, asOf);
}

/**
 * Get a complete snapshot of all account balances at a point in time
 */
export async function getBalanceSnapshotAt(userId: string, asOf: Date): Promise<NetWorthSnapshot> {
	const accounts = await getAllAccountBalancesAsOf(userId, asOf);
	const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

	return {
		timestamp: asOf,
		totalBalance,
		accounts: accounts.map((acc) => ({
			accountId: acc.accountId,
			name: acc.name,
			balance: acc.balance
		}))
	};
}

/**
 * Get net worth over time (for charts)
 * Returns daily snapshots between start and end dates
 */
export async function getNetWorthOverTime(
	userId: string,
	startDate: Date,
	endDate: Date,
	intervalDays: number = 1
): Promise<Array<{ date: Date; netWorth: number }>> {
	// Validate date range
	if (startDate > endDate) {
		throw new Error('startDate must be before or equal to endDate');
	}

	// Validate interval
	if (intervalDays <= 0 || !Number.isInteger(intervalDays)) {
		throw new Error('intervalDays must be a positive integer');
	}

	// Limit the number of data points to prevent performance issues
	const maxDays = 3650; // ~10 years
	const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
	const dataPointsCount = Math.ceil(daysDiff / intervalDays);

	if (dataPointsCount > maxDays) {
		throw new Error(
			`Date range with interval would generate ${dataPointsCount} data points. ` +
				`Maximum allowed is ${maxDays}. Please increase interval or reduce date range.`
		);
	}

	const snapshots: Array<{ date: Date; netWorth: number }> = [];

	const current = new Date(startDate);
	while (current <= endDate) {
		const netWorth = await getNetWorthAsOf(userId, current);
		snapshots.push({
			date: new Date(current),
			netWorth
		});
		current.setDate(current.getDate() + intervalDays);
	}

	return snapshots;
}

/**
 * Get the complete audit trail for an account
 * Includes all events with metadata for compliance
 */
export async function getAuditTrail(accountId: string): Promise<AuditEntry[]> {
	const trail = await getAccountAuditTrail(accountId);
	return trail.map((entry) => ({
		eventId: entry.eventId,
		eventType: entry.eventType,
		userId: entry.userId,
		occurredAt: entry.occurredAt,
		payload: entry.payload,
		metadata: entry.metadata
	}));
}

/**
 * Compare balances between two dates
 */
export async function compareBalances(
	userId: string,
	date1: Date,
	date2: Date
): Promise<{
	date1Snapshot: NetWorthSnapshot;
	date2Snapshot: NetWorthSnapshot;
	netWorthChange: number;
	accountChanges: Array<{
		accountId: string;
		name: string;
		balance1: number;
		balance2: number;
		change: number;
	}>;
}> {
	const snapshot1 = await getBalanceSnapshotAt(userId, date1);
	const snapshot2 = await getBalanceSnapshotAt(userId, date2);

	// Build account changes map
	const accountMap = new Map<string, { name: string; balance1: number; balance2: number }>();

	for (const acc of snapshot1.accounts) {
		accountMap.set(acc.accountId, {
			name: acc.name,
			balance1: acc.balance,
			balance2: 0
		});
	}

	for (const acc of snapshot2.accounts) {
		const existing = accountMap.get(acc.accountId);
		if (existing) {
			existing.balance2 = acc.balance;
		} else {
			accountMap.set(acc.accountId, {
				name: acc.name,
				balance1: 0,
				balance2: acc.balance
			});
		}
	}

	const accountChanges = Array.from(accountMap.entries()).map(([accountId, data]) => ({
		accountId,
		name: data.name,
		balance1: data.balance1,
		balance2: data.balance2,
		change: data.balance2 - data.balance1
	}));

	return {
		date1Snapshot: snapshot1,
		date2Snapshot: snapshot2,
		netWorthChange: snapshot2.totalBalance - snapshot1.totalBalance,
		accountChanges
	};
}
