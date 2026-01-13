import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { AccountType } from '$lib/domain/account';

export const user = sqliteTable('user', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	age: integer('age')
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
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
