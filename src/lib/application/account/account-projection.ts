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
import type { Goal } from '$lib/domain/account';
import type { DomainEvent } from '$lib/domain/events';

export interface AccountWithGoal extends AccountState {
	goal?: Goal | null;
}

export interface AccountWithHistory extends AccountWithGoal {
	balanceHistory: BalanceSnapshot[];
}

/**
 * Configuration for snapshot behavior.
 *
 * These values are chosen to balance read performance (how many events we have to replay)
 * against storage and write amplification (how many snapshots we keep and how often we write them).
 *
 * - SNAPSHOT_INTERVAL:
 *   - We create a new snapshot after roughly this many new events have been appended.
 *   - A value of 50 keeps the worst‑case replay size small enough for typical account
 *     streams (tens of events per request) while avoiding excessive snapshot writes
 *     on very active accounts.
 *   - Lowering this value:
 *       • Reduces the number of events that must be replayed on reads (better latency),
 *       • But increases how often snapshots are written (more I/O and storage churn).
 *   - Raising this value:
 *       • Decreases snapshot write frequency and storage usage,
 *       • But increases replay cost on reads as more events must be applied.
 *
 * - MAX_SNAPSHOTS_PER_STREAM:
 *   - We keep only the latest N snapshots for each account stream.
 *   - A value of 3 provides multiple recent checkpoints so that:
 *       • Replay remains bounded even if the latest snapshot is relatively old, and
 *       • Storage does not grow unbounded for long‑lived, high‑traffic accounts.
 *   - Lowering this value reduces snapshot storage further but may increase replay
 *     cost for very old streams.
 *   - Raising this value keeps more historical checkpoints at the cost of additional
 *     snapshot rows per stream.
 *
 * These defaults are conservative and can be tuned based on observed event volume and
 * latency/storage requirements in a specific deployment.
 */
const SNAPSHOT_CONFIG = {
	/** Number of new events on a stream after which we attempt to create a snapshot. */
	SNAPSHOT_INTERVAL: 50,
	/** Maximum number of snapshots to keep per stream before older ones are pruned. */
	MAX_SNAPSHOTS_PER_STREAM: 3
};

/** Pre-calculated snapshot retention window to avoid recalculating on every cleanup */
const SNAPSHOT_RETENTION_WINDOW =
	SNAPSHOT_CONFIG.SNAPSHOT_INTERVAL * SNAPSHOT_CONFIG.MAX_SNAPSHOTS_PER_STREAM;

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

		// Fetch goal for the account
		const goal = await eventStoreRepo.getGoalByAccount(accountId);

		// Maybe create a new snapshot if many events have accumulated
		await maybeCreateSnapshot(accountId, state, eventsAfterSnapshot.length);

		return { ...state, goal };
	}

	// No snapshot, replay all events
	const events = await eventStoreRepo.getStream(accountId);
	const state = projectAccountState(events);

	if (!state) return null;

	// Fetch goal for the account
	const goal = await eventStoreRepo.getGoalByAccount(accountId);

	// Create initial snapshot if we have enough events
	if (events.length >= SNAPSHOT_CONFIG.SNAPSHOT_INTERVAL) {
		await createSnapshot(accountId, state);
	}

	return { ...state, goal };
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
export async function getAccountWithHistory(accountId: string): Promise<AccountWithHistory | null> {
	const events = await eventStoreRepo.getStream(accountId);
	const state = projectAccountState(events);

	if (!state) return null;

	const goal = await eventStoreRepo.getGoalByAccount(accountId);
	const balanceHistory = projectBalanceHistory(events);

	return {
		...state,
		goal,
		balanceHistory
	};
}

/**
 * Get balance at a specific point in time
 */
export async function getAccountBalanceAsOf(accountId: string, asOf: Date): Promise<number | null> {
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
export async function getUserAccountsWithHistory(userId: string): Promise<AccountWithHistory[]> {
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
 * Uses batch query to avoid N+1 problem
 */
export async function getNetWorthAsOf(userId: string, asOf: Date): Promise<number> {
	// Fetch all events for user's accounts in a single query
	const events = await eventStoreRepo.getEventsByUserAndTypeAsOf(userId, 'account', asOf);

	// Group events by stream ID
	const eventsByStream = new Map<string, DomainEvent[]>();
	for (const event of events) {
		const streamEvents = eventsByStream.get(event.streamId) ?? [];
		streamEvents.push(event);
		eventsByStream.set(event.streamId, streamEvents);
	}

	// Calculate balance for each account stream
	let netWorth = 0;
	for (const [_streamId, streamEvents] of eventsByStream) {
		const state = projectAccountState(streamEvents);
		if (state && !state.isDeleted) {
			const balance = getBalanceAtTime(streamEvents, asOf);
			if (balance !== null) {
				netWorth += balance;
			}
		}
	}

	return netWorth;
}

/**
 * Get balance snapshots for all accounts at a point in time
 * Uses batch query to avoid N+1 problem
 */
export async function getAllAccountBalancesAsOf(
	userId: string,
	asOf: Date
): Promise<Array<{ accountId: string; balance: number; name: string }>> {
	// Fetch all events for user's accounts in a single query
	const events = await eventStoreRepo.getEventsByUserAndTypeAsOf(userId, 'account', asOf);

	// Group events by stream ID
	const eventsByStream = new Map<string, DomainEvent[]>();
	for (const event of events) {
		const streamEvents = eventsByStream.get(event.streamId) ?? [];
		streamEvents.push(event);
		eventsByStream.set(event.streamId, streamEvents);
	}

	// Calculate balance and get name for each account stream
	const balances: Array<{ accountId: string; balance: number; name: string }> = [];
	for (const [streamId, streamEvents] of eventsByStream) {
		const state = projectAccountState(streamEvents);
		if (state && !state.isDeleted) {
			const balance = getBalanceAtTime(streamEvents, asOf);
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
	// Clamp to 0 so we never produce a negative version; we only start deleting
	// once we've advanced beyond the initial retention window.
	const keepAfterVersion = Math.max(0, state.version - SNAPSHOT_RETENTION_WINDOW);
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
