import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import type { AccountType } from '$lib/domain/account';
import type { TransactionType } from '$lib/domain/transaction';
import type { EventType, StreamType } from '$lib/domain/events';

// ─────────────────────────────────────────────────────────────────────────────
// Core Tables
// ─────────────────────────────────────────────────────────────────────────────

export const user = sqliteTable('user', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	firstName: text('first_name'),
	lastName: text('last_name'),
	phoneNumber: text('phone_number'),
	dateOfBirth: integer('date_of_birth', { mode: 'timestamp' }),
	preferredCurrency: text('preferred_currency').default('USD'),
	timezone: text('timezone').default('UTC'),
	age: integer('age'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Store - The source of truth for all state changes
// ─────────────────────────────────────────────────────────────────────────────

export const eventStore = sqliteTable(
	'event_store',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		streamId: text('stream_id').notNull(), // The aggregate ID (e.g., account ID)
		streamType: text('stream_type').$type<StreamType>().notNull(), // 'account', 'transaction'
		eventType: text('event_type').$type<EventType>().notNull(),
		payload: text('payload', { mode: 'json' }).notNull(), // JSON payload
		version: integer('version').notNull(), // Version within stream for optimistic concurrency
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		metadata: text('metadata', { mode: 'json' }), // Optional JSON metadata
		occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
	},
	(table) => [
		index('idx_event_store_stream').on(table.streamId, table.version),
		index('idx_event_store_stream_type').on(table.streamType),
		index('idx_event_store_event_type').on(table.eventType),
		index('idx_event_store_user').on(table.userId),
		index('idx_event_store_occurred_at').on(table.occurredAt)
	]
);

// ─────────────────────────────────────────────────────────────────────────────
// Read Models (Projections) - Denormalized views for fast queries
// These are rebuilt from events but cached for performance
// ─────────────────────────────────────────────────────────────────────────────

export const account = sqliteTable('account', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	type: text('type').$type<AccountType>().notNull(),
	currentBalance: integer('current_balance').notNull(),
	initialBalance: integer('initial_balance').notNull(),
	currencyCode: text('currency_code').notNull(),
	currencySymbol: text('currency_symbol').notNull(),
	color: text('color').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

export const transaction = sqliteTable('transaction', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	accountId: text('account_id')
		.notNull()
		.references(() => account.id, { onDelete: 'cascade' }),
	type: text('type').$type<TransactionType>().notNull(),
	amount: integer('amount').notNull(),
	name: text('name'),
	description: text('description'),
	category: text('category'),
	payee: text('payee'),
	toAccountId: text('to_account_id').references(() => account.id, { onDelete: 'cascade' }),
	deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft delete for audit trail
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshots - Periodic state captures for performance optimization
// Instead of replaying all events, load snapshot + events after snapshot
// ─────────────────────────────────────────────────────────────────────────────

export const accountSnapshot = sqliteTable(
	'account_snapshot',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		streamId: text('stream_id').notNull(), // The account ID
		state: text('state', { mode: 'json' }).notNull(), // Serialized AccountState
		version: integer('version').notNull(), // Version at which snapshot was taken
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
	},
	(table) => [
		index('idx_account_snapshot_stream').on(table.streamId),
		index('idx_account_snapshot_version').on(table.streamId, table.version)
	]
);
