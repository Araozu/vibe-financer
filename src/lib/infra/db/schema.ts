import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { AccountType } from '$lib/domain/account';
import type { TransactionType } from '$lib/domain/transaction';

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
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});
