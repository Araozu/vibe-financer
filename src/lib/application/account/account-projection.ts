/**
 * Account Projection Service
 *
 * Rebuilds account state from the event store.
 * Provides queries for current state and historical state.
 * Uses snapshots for performance optimization.
 */

import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import {
	projectAccountState,
	projectAccountStateFromSnapshot,
	projectBalanceHistory,
	getBalanceAtTime,
	type AccountState,
	type BalanceSnapshot
} from '$lib/domain/account-aggregate';
import type { DomainEvent } from '$lib/domain/events';

export interface AccountWithHistory extends AccountState {
	balanceHistory: BalanceSnapshot[];
}

/**
 * Configuration for snapshot behavior
 */
const SNAPSHOT_CONFIG = {
	/** Number of events after which to create a snapshot */
	SNAPSHOT_INTERVAL: 50,
	/** Maximum number of snapshots to keep per stream */
	MAX_SNAPSHOTS_PER_STREAM: 3
};

/**
 * Get the current state of an account using snapshot optimization
 * Loads the latest snapshot and only replays events after it
 */
export async function getAccountState(accountId: string): Promise<AccountState | null> {
	// Try to load from snapshot first
	const snapshot = await eventStoreRepo.getLatestSnapshot(accountId);

	if (snapshot) {
		// Get only events after the snapshot
		const eventsAfterSnapshot = await eventStoreRepo.getStreamAfterVersion(
			accountId,
			snapshot.version
		);

		// If no new events, return snapshot state directly
		if (eventsAfterSnapshot.length === 0) {
			return snapshot.state;
		}

		// Project from snapshot + new events
		const state = projectAccountStateFromSnapshot(snapshot.state, eventsAfterSnapshot);

		// Maybe create a new snapshot if many events have accumulated
		await maybeCreateSnapshot(accountId, state, eventsAfterSnapshot.length);

		return state;
	}

	// No snapshot, replay all events
	const events = await eventStoreRepo.getStream(accountId);
	const state = projectAccountState(events);

	// Create initial snapshot if we have enough events
	if (state && events.length >= SNAPSHOT_CONFIG.SNAPSHOT_INTERVAL) {
		await createSnapshot(accountId, state);
	}

	return state;
}

/**
 * Get account state at a specific point in time
 * Note: Time-travel queries don't use snapshots (they need exact historical state)
 */
export async function getAccountStateAsOf(
	accountId: string,
	asOf: Date
): Promise<AccountState | null> {
	const events = await eventStoreRepo.getStreamAsOf(accountId, asOf);
	return projectAccountState(events);
}

/**
 * Get account with full balance history
 */
export async function getAccountWithHistory(
	accountId: string
): Promise<AccountWithHistory | null> {
	const events = await eventStoreRepo.getStream(accountId);
	const state = projectAccountState(events);

	if (!state) return null;

	const balanceHistory = projectBalanceHistory(events);

	return {
		...state,
		balanceHistory
	};
}

/**
 * Get balance at a specific point in time
 */
export async function getAccountBalanceAsOf(
	accountId: string,
	asOf: Date
): Promise<number | null> {
	const events = await eventStoreRepo.getStreamAsOf(accountId, asOf);
	return getBalanceAtTime(events, asOf);
}

/**
 * Get all accounts for a user
 */
export async function getUserAccounts(userId: string): Promise<AccountState[]> {
	const streamIds = await eventStoreRepo.getStreamIdsByUserAndType(userId, 'account');

	const accounts: AccountState[] = [];
	for (const streamId of streamIds) {
		const state = await getAccountState(streamId);
		if (state && !state.isDeleted) {
			accounts.push(state);
		}
	}

	return accounts;
}

/**
 * Get all accounts for a user with their balance history
 */
export async function getUserAccountsWithHistory(
	userId: string
): Promise<AccountWithHistory[]> {
	const streamIds = await eventStoreRepo.getStreamIdsByUserAndType(userId, 'account');

	const accounts: AccountWithHistory[] = [];
	for (const streamId of streamIds) {
		const accountWithHistory = await getAccountWithHistory(streamId);
		if (accountWithHistory && !accountWithHistory.isDeleted) {
			accounts.push(accountWithHistory);
		}
	}

	return accounts;
}

/**
 * Get the current version of an account stream (for optimistic concurrency)
 */
export async function getAccountVersion(accountId: string): Promise<number> {
	return eventStoreRepo.getStreamVersion(accountId);
}

/**
 * Get audit trail for an account
 */
export async function getAccountAuditTrail(accountId: string) {
	return eventStoreRepo.getAuditTrail(accountId);
}

/**
 * Get balance history between two dates
 */
export async function getBalanceHistoryBetween(
	accountId: string,
	startDate: Date,
	endDate: Date
): Promise<BalanceSnapshot[]> {
	const events = await eventStoreRepo.getStreamAsOf(accountId, endDate);
	const fullHistory = projectBalanceHistory(events);

	return fullHistory.filter(
		(snapshot) => snapshot.timestamp >= startDate && snapshot.timestamp <= endDate
	);
}

/**
 * Get net worth at a point in time (sum of all account balances)
 */
export async function getNetWorthAsOf(userId: string, asOf: Date): Promise<number> {
	const streamIds = await eventStoreRepo.getStreamIdsByUserAndType(userId, 'account');

	let netWorth = 0;
	for (const streamId of streamIds) {
		const balance = await getAccountBalanceAsOf(streamId, asOf);
		if (balance !== null) {
			netWorth += balance;
		}
	}

	return netWorth;
}

/**
 * Get balance snapshots for all accounts at a point in time
 */
export async function getAllAccountBalancesAsOf(
	userId: string,
	asOf: Date
): Promise<Array<{ accountId: string; balance: number; name: string }>> {
	const streamIds = await eventStoreRepo.getStreamIdsByUserAndType(userId, 'account');

	const balances: Array<{ accountId: string; balance: number; name: string }> = [];
	for (const streamId of streamIds) {
		const state = await getAccountStateAsOf(streamId, asOf);
		if (state && !state.isDeleted) {
			const balance = await getAccountBalanceAsOf(streamId, asOf);
			if (balance !== null) {
				balances.push({
					accountId: streamId,
					balance,
					name: state.name
				});
			}
		}
	}

	return balances;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maybe create a snapshot if enough events have accumulated
 */
async function maybeCreateSnapshot(
	accountId: string,
	state: AccountState,
	eventsSinceSnapshot: number
): Promise<void> {
	if (eventsSinceSnapshot >= SNAPSHOT_CONFIG.SNAPSHOT_INTERVAL) {
		await createSnapshot(accountId, state);
	}
}

/**
 * Create a snapshot for an account
 */
async function createSnapshot(accountId: string, state: AccountState): Promise<void> {
	await eventStoreRepo.saveSnapshot(accountId, state, state.version);

	// Cleanup old snapshots
	const keepAfterVersion = state.version - SNAPSHOT_CONFIG.SNAPSHOT_INTERVAL * SNAPSHOT_CONFIG.MAX_SNAPSHOTS_PER_STREAM;
	if (keepAfterVersion > 0) {
		await eventStoreRepo.deleteOldSnapshots(accountId, keepAfterVersion);
	}
}

/**
 * Force create a snapshot for an account (useful after bulk operations)
 */
export async function forceCreateSnapshot(accountId: string): Promise<void> {
	const events = await eventStoreRepo.getStream(accountId);
	const state = projectAccountState(events);

	if (state) {
		await createSnapshot(accountId, state);
	}
}

/**
 * Invalidate all snapshots for an account (useful when rebuilding)
 */
export async function invalidateSnapshots(accountId: string): Promise<void> {
	await eventStoreRepo.deleteSnapshots(accountId);
}
