import { pgTable, text, integer, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import type { AccountType } from '$lib/domain/account';
import type { TransactionType } from '$lib/domain/transaction';
import type { EventType, StreamType } from '$lib/domain/events';

// ─────────────────────────────────────────────────────────────────────────────
// Core Tables
// ─────────────────────────────────────────────────────────────────────────────

export const user = pgTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	firstName: text('first_name'),
	lastName: text('last_name'),
	phoneNumber: text('phone_number'),
	dateOfBirth: timestamp('date_of_birth', { withTimezone: true, mode: 'date' }),
	preferredCurrency: text('preferred_currency').default('USD'),
	timezone: text('timezone').default('UTC'),
	age: integer('age'),
	defaultAccountId: text('default_account_id'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Store - The source of truth for all state changes
// ─────────────────────────────────────────────────────────────────────────────

export const eventStore = pgTable(
	'event_store',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		streamId: text('stream_id').notNull(), // The aggregate ID (e.g., account ID)
		streamType: text('stream_type').$type<StreamType>().notNull(), // 'account', 'transaction'
		eventType: text('event_type').$type<EventType>().notNull(),
		payload: jsonb('payload').notNull(), // JSONB payload
		version: integer('version').notNull(), // Version within stream for optimistic concurrency
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		metadata: jsonb('metadata'), // Optional JSONB metadata
		occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		uniqueIndex('idx_event_store_stream').on(table.streamId, table.version),
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

export const currency = pgTable('currency', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	code: text('code').notNull().unique(),
	symbol: text('symbol').notNull(),
	name: text('name').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const account = pgTable('account', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	type: text('type').$type<AccountType>().notNull(),
	currentBalance: integer('current_balance').notNull(),
	initialBalance: integer('initial_balance').notNull(),
	currencyId: text('currency_id')
		.notNull()
		.references(() => currency.id),
	color: text('color').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const goal = pgTable('goal', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	accountId: text('account_id')
		.notNull()
		.unique()
		.references(() => account.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	targetAmount: integer('target_amount').notNull(),
	targetDate: timestamp('target_date', { withTimezone: true, mode: 'date' }),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const transaction = pgTable('transaction', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
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
	deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }), // Soft delete for audit trail
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const budget = pgTable('budget', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	category: text('category').notNull(),
	limit: integer('limit').notNull(),
	currencyId: text('currency_id')
		.notNull()
		.references(() => currency.id),
	period: text('period').$type<'monthly' | 'weekly' | 'yearly'>().notNull(),
	startDate: timestamp('start_date', { withTimezone: true, mode: 'date' }).notNull(),
	currentSpent: integer('current_spent').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshots - Periodic state captures for performance optimization
// Instead of replaying all events, load snapshot + events after snapshot
// ─────────────────────────────────────────────────────────────────────────────

export const accountSnapshot = pgTable(
	'account_snapshot',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		streamId: text('stream_id').notNull(), // The account ID
		state: jsonb('state').notNull(), // JSONB state
		version: integer('version').notNull(), // Version at which snapshot was taken
		createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('idx_account_snapshot_stream').on(table.streamId),
		index('idx_account_snapshot_version').on(table.streamId, table.version)
	]
);
