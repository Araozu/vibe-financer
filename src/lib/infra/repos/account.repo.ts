import { db } from '../db';
import { account, currency, goal } from '../db/schema';
import { asc, eq } from 'drizzle-orm';
import type { Account, CreateAccountDTO, UpdateAccountDTO, Goal } from '../../domain/account';

export const accountRepo = {
	async create(data: CreateAccountDTO): Promise<Account> {
		const [result] = await db.insert(account).values(data).returning();
		return result;
	},

	async findById(id: string): Promise<(Account & { goal: Goal | null }) | undefined> {
		const result = await db
			.select({
				id: account.id,
				userId: account.userId,
				name: account.name,
				description: account.description,
				type: account.type,
				currentBalance: account.currentBalance,
				initialBalance: account.initialBalance,
				currencyId: account.currencyId,
				color: account.color,
				createdAt: account.createdAt,
				updatedAt: account.updatedAt,
				currencyCode: currency.code,
				currencySymbol: currency.symbol,
				goal: {
					id: goal.id,
					accountId: goal.accountId,
					name: goal.name,
					targetAmount: goal.targetAmount,
					targetDate: goal.targetDate,
					createdAt: goal.createdAt,
					updatedAt: goal.updatedAt
				}
			})
			.from(account)
			.leftJoin(currency, eq(account.currencyId, currency.id))
			.leftJoin(goal, eq(account.id, goal.accountId))
			.where(eq(account.id, id));

		if (result.length === 0) return undefined;

		const row = result[0];
		return {
			...row,
			goal: row.goal?.id ? (row.goal as Goal) : null
		};
	},

	async findByUserId(userId: string): Promise<Array<Account & { goal: Goal | null }>> {
		const results = await db
			.select({
				id: account.id,
				userId: account.userId,
				name: account.name,
				description: account.description,
				type: account.type,
				currentBalance: account.currentBalance,
				initialBalance: account.initialBalance,
				currencyId: account.currencyId,
				color: account.color,
				createdAt: account.createdAt,
				updatedAt: account.updatedAt,
				currencyCode: currency.code,
				currencySymbol: currency.symbol,
				goal: {
					id: goal.id,
					accountId: goal.accountId,
					name: goal.name,
					targetAmount: goal.targetAmount,
					targetDate: goal.targetDate,
					createdAt: goal.createdAt,
					updatedAt: goal.updatedAt
				}
			})
			.from(account)
			.leftJoin(currency, eq(account.currencyId, currency.id))
			.leftJoin(goal, eq(account.id, goal.accountId))
			.where(eq(account.userId, userId))
			.orderBy(asc(account.name), asc(account.id));

		return results.map((row) => ({
			...row,
			goal: row.goal?.id ? (row.goal as Goal) : null
		}));
	},

	async findAll(): Promise<Array<Account & { goal: Goal | null }>> {
		const results = await db
			.select({
				id: account.id,
				userId: account.userId,
				name: account.name,
				description: account.description,
				type: account.type,
				currentBalance: account.currentBalance,
				initialBalance: account.initialBalance,
				currencyId: account.currencyId,
				color: account.color,
				createdAt: account.createdAt,
				updatedAt: account.updatedAt,
				currencyCode: currency.code,
				currencySymbol: currency.symbol,
				goal: {
					id: goal.id,
					accountId: goal.accountId,
					name: goal.name,
					targetAmount: goal.targetAmount,
					targetDate: goal.targetDate,
					createdAt: goal.createdAt,
					updatedAt: goal.updatedAt
				}
			})
			.from(account)
			.leftJoin(currency, eq(account.currencyId, currency.id))
			.leftJoin(goal, eq(account.id, goal.accountId));

		return results.map((row) => ({
			...row,
			goal: row.goal?.id ? (row.goal as Goal) : null
		}));
	},

	async update(id: string, data: UpdateAccountDTO): Promise<Account | undefined> {
		const [result] = await db
			.update(account)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(account.id, id))
			.returning();
		return result;
	},

	async updateBalance(id: string, newBalance: number): Promise<Account | undefined> {
		const [result] = await db
			.update(account)
			.set({ currentBalance: newBalance, updatedAt: new Date() })
			.where(eq(account.id, id))
			.returning();
		return result;
	}
};
