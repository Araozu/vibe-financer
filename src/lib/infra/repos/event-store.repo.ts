/**
 * Event Store Repository
 *
 * This is the core infrastructure for event sourcing.
 * All state changes are persisted as immutable events.
 */

import { db } from '../db';
import { eventStore, account, transaction, accountSnapshot } from '../db/schema';
import { eq, and, asc, desc, lte, gt, sql } from 'drizzle-orm';
import type { DomainEvent, StreamType, EventType } from '$lib/domain/events';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { AccountState } from '$lib/domain/account-aggregate';

export interface StoredEvent {
	id: string;
	streamId: string;
	streamType: StreamType;
	eventType: EventType;
	payload: unknown;
	version: number;
	userId: string;
	metadata: Record<string, unknown> | null;
	occurredAt: Date;
}

export interface AppendEventOptions {
	expectedVersion?: number; // For optimistic concurrency
}

export class ConcurrencyError extends Error {
	constructor(
		public streamId: string,
		public expectedVersion: number,
		public actualVersion: number
	) {
		super(
			`Concurrency conflict on stream ${streamId}: expected version ${expectedVersion}, but found ${actualVersion}`
		);
		this.name = 'ConcurrencyError';
	}
}

/**
 * Convert stored event to domain event
 */
function toDomainEvent(stored: StoredEvent): DomainEvent {
	return {
		id: stored.id,
		streamId: stored.streamId,
		streamType: stored.streamType,
		eventType: stored.eventType,
		payload: stored.payload,
		version: stored.version,
		userId: stored.userId,
		metadata: stored.metadata ?? undefined,
		occurredAt: stored.occurredAt
	} as DomainEvent;
}

export const eventStoreRepo = {
	/**
	 * Append a single event to a stream
	 */
	async append(
		event: DomainEvent,
		options?: AppendEventOptions
	): Promise<DomainEvent> {
		return db.transaction(async (tx) => {
			// Check for optimistic concurrency if expected version provided
			if (options?.expectedVersion !== undefined) {
				const currentVersion = await this.getStreamVersion(event.streamId, tx);
				if (currentVersion !== options.expectedVersion) {
					throw new ConcurrencyError(
						event.streamId,
						options.expectedVersion,
						currentVersion
					);
				}
			}

			const [result] = await tx
				.insert(eventStore)
				.values({
					id: event.id,
					streamId: event.streamId,
					streamType: event.streamType,
					eventType: event.eventType,
					payload: event.payload,
					version: event.version,
					userId: event.userId,
					metadata: event.metadata ?? null,
					occurredAt: event.occurredAt
				})
				.returning();

			return toDomainEvent(result as StoredEvent);
		});
	},

	/**
	 * Append multiple events atomically
	 */
	async appendMany(
		events: DomainEvent[],
		options?: AppendEventOptions
	): Promise<DomainEvent[]> {
		if (events.length === 0) return [];

		return db.transaction(async (tx) => {
			// Check for optimistic concurrency on the first event's stream
			if (options?.expectedVersion !== undefined && events.length > 0) {
				const currentVersion = await this.getStreamVersion(events[0].streamId, tx);
				if (currentVersion !== options.expectedVersion) {
					throw new ConcurrencyError(
						events[0].streamId,
						options.expectedVersion,
						currentVersion
					);
				}
			}

			const results = await tx
				.insert(eventStore)
				.values(
					events.map((e) => ({
						id: e.id,
						streamId: e.streamId,
						streamType: e.streamType,
						eventType: e.eventType,
						payload: e.payload,
						version: e.version,
						userId: e.userId,
						metadata: e.metadata ?? null,
						occurredAt: e.occurredAt
					}))
				)
				.returning();

			return results.map((r) => toDomainEvent(r as StoredEvent));
		});
	},

	/**
	 * Get all events for a stream, ordered by version
	 */
	async getStream(streamId: string): Promise<DomainEvent[]> {
		const results = await db
			.select()
			.from(eventStore)
			.where(eq(eventStore.streamId, streamId))
			.orderBy(asc(eventStore.version));

		return results.map((r) => toDomainEvent(r as StoredEvent));
	},

	/**
	 * Get events for a stream up to a specific version
	 */
	async getStreamUpToVersion(
		streamId: string,
		maxVersion: number
	): Promise<DomainEvent[]> {
		const results = await db
			.select()
			.from(eventStore)
			.where(
				and(
					eq(eventStore.streamId, streamId),
					lte(eventStore.version, maxVersion)
				)
			)
			.orderBy(asc(eventStore.version));

		return results.map((r) => toDomainEvent(r as StoredEvent));
	},

	/**
	 * Get events for a stream up to a specific point in time
	 */
	async getStreamAsOf(streamId: string, asOf: Date): Promise<DomainEvent[]> {
		const results = await db
			.select()
			.from(eventStore)
			.where(
				and(
					eq(eventStore.streamId, streamId),
					lte(eventStore.occurredAt, asOf)
				)
			)
			.orderBy(asc(eventStore.version));

		return results.map((r) => toDomainEvent(r as StoredEvent));
	},

	/**
	 * Get all events for a user's streams
	 */
	async getEventsByUser(userId: string): Promise<DomainEvent[]> {
		const results = await db
			.select()
			.from(eventStore)
			.where(eq(eventStore.userId, userId))
			.orderBy(asc(eventStore.occurredAt));

		return results.map((r) => toDomainEvent(r as StoredEvent));
	},

	/**
	 * Get all events of a specific type
	 */
	async getEventsByType(eventType: EventType): Promise<DomainEvent[]> {
		const results = await db
			.select()
			.from(eventStore)
			.where(eq(eventStore.eventType, eventType))
			.orderBy(asc(eventStore.occurredAt));

		return results.map((r) => toDomainEvent(r as StoredEvent));
	},

	/**
	 * Get all streams for a user by stream type
	 */
	async getStreamIdsByUserAndType(
		userId: string,
		streamType: StreamType
	): Promise<string[]> {
		const results = await db
			.selectDistinct({ streamId: eventStore.streamId })
			.from(eventStore)
			.where(
				and(
					eq(eventStore.userId, userId),
					eq(eventStore.streamType, streamType)
				)
			);

		return results.map((r) => r.streamId);
	},

	/**
	 * Get the current version of a stream
	 */
	async getStreamVersion(
		streamId: string,
		tx?: BunSQLiteDatabase<Record<string, never>>
	): Promise<number> {
		const dbInstance = tx ?? db;
		const [result] = await dbInstance
			.select({ maxVersion: sql<number>`MAX(${eventStore.version})` })
			.from(eventStore)
			.where(eq(eventStore.streamId, streamId));

		return result?.maxVersion ?? 0;
	},

	/**
	 * Get all events in order (for global replay)
	 */
	async getAllEvents(limit?: number): Promise<DomainEvent[]> {
		let query = db
			.select()
			.from(eventStore)
			.orderBy(asc(eventStore.occurredAt));

		if (limit) {
			query = query.limit(limit) as typeof query;
		}

		const results = await query;
		return results.map((r) => toDomainEvent(r as StoredEvent));
	},

	/**
	 * Get audit trail for a specific entity
	 * Returns all events with their metadata for compliance/debugging
	 */
	async getAuditTrail(streamId: string): Promise<
		Array<{
			eventId: string;
			eventType: EventType;
			userId: string;
			occurredAt: Date;
			payload: unknown;
			metadata: Record<string, unknown> | null;
		}>
	> {
		const results = await db
			.select({
				eventId: eventStore.id,
				eventType: eventStore.eventType,
				userId: eventStore.userId,
				occurredAt: eventStore.occurredAt,
				payload: eventStore.payload,
				metadata: eventStore.metadata
			})
			.from(eventStore)
			.where(eq(eventStore.streamId, streamId))
			.orderBy(asc(eventStore.version));

		return results as Array<{
			eventId: string;
			eventType: EventType;
			userId: string;
			occurredAt: Date;
			payload: unknown;
			metadata: Record<string, unknown> | null;
		}>;
	},

	/**
	 * Update read model (projection) for an account
	 * This is called after events are appended to keep the read model in sync
	 */
	async updateAccountProjection(
		accountId: string,
		data: {
			name?: string;
			description?: string | null;
			type?: 'asset' | 'expense' | 'revenue' | 'liability';
			initialBalance?: number;
			currentBalance?: number;
			currencyCode?: string;
			currencySymbol?: string;
			color?: string;
		}
	): Promise<void> {
		await db
			.update(account)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(account.id, accountId));
	},

	/**
	 * Create read model (projection) for a new account
	 */
	async createAccountProjection(data: {
		id: string;
		userId: string;
		name: string;
		description: string | null;
		type: 'asset' | 'expense' | 'revenue' | 'liability';
		initialBalance: number;
		currentBalance: number;
		currencyCode: string;
		currencySymbol: string;
		color: string;
	}): Promise<void> {
		await db.insert(account).values(data);
	},

	/**
	 * Create read model (projection) for a new transaction
	 */
	async createTransactionProjection(data: {
		id: string;
		accountId: string;
		type: 'expense' | 'income' | 'transfer';
		amount: number;
		name: string | null;
		description: string | null;
		category: string | null;
		payee: string | null;
		toAccountId: string | null;
		createdAt: Date;
	}): Promise<void> {
		await db.insert(transaction).values(data);
	},

	// ─────────────────────────────────────────────────────────────────────────────
	// Snapshot Operations
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Save a snapshot of account state at a specific version
	 */
	async saveSnapshot(streamId: string, state: AccountState, version: number): Promise<void> {
		await db.insert(accountSnapshot).values({
			streamId,
			state: state as unknown as Record<string, unknown>,
			version
		});
	},

	/**
	 * Get the latest snapshot for a stream
	 */
	async getLatestSnapshot(streamId: string): Promise<{ state: AccountState; version: number } | null> {
		const [result] = await db
			.select()
			.from(accountSnapshot)
			.where(eq(accountSnapshot.streamId, streamId))
			.orderBy(desc(accountSnapshot.version))
			.limit(1);

		if (!result) return null;

		return {
			state: result.state as unknown as AccountState,
			version: result.version
		};
	},

	/**
	 * Get events after a specific version (for replaying after snapshot)
	 */
	async getStreamAfterVersion(streamId: string, afterVersion: number): Promise<DomainEvent[]> {
		const results = await db
			.select()
			.from(eventStore)
			.where(
				and(
					eq(eventStore.streamId, streamId),
					gt(eventStore.version, afterVersion)
				)
			)
			.orderBy(asc(eventStore.version));

		return results.map((r) => toDomainEvent(r as StoredEvent));
	},

	/**
	 * Delete all snapshots for a stream (useful when rebuilding)
	 */
	async deleteSnapshots(streamId: string): Promise<void> {
		await db.delete(accountSnapshot).where(eq(accountSnapshot.streamId, streamId));
	},

	/**
	 * Delete snapshots older than a specific version (cleanup)
	 */
	async deleteOldSnapshots(streamId: string, keepAfterVersion: number): Promise<void> {
		await db
			.delete(accountSnapshot)
			.where(
				and(
					eq(accountSnapshot.streamId, streamId),
					lte(accountSnapshot.version, keepAfterVersion)
				)
			);
	},

	/**
	 * Get all stream IDs that have events (for bulk operations)
	 */
	async getAllStreamIds(streamType?: StreamType): Promise<string[]> {
		const whereClause = streamType ? eq(eventStore.streamType, streamType) : undefined;

		const results = await db
			.selectDistinct({ streamId: eventStore.streamId })
			.from(eventStore)
			.where(whereClause);

		return results.map((r) => r.streamId);
	},

	/**
	 * Delete account projection (for rebuild)
	 */
	async deleteAccountProjection(accountId: string): Promise<void> {
		await db.delete(account).where(eq(account.id, accountId));
	},

	/**
	 * Delete transaction projection (for rebuild)
	 */
	async deleteTransactionProjection(transactionId: string): Promise<void> {
		await db.delete(transaction).where(eq(transaction.id, transactionId));
	},

	/**
	 * Delete all transaction projections for an account (for rebuild)
	 */
	async deleteTransactionProjectionsByAccount(accountId: string): Promise<void> {
		await db.delete(transaction).where(eq(transaction.accountId, accountId));
	}
};
