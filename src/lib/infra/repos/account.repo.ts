import { db } from '../db';
import { account, currency } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Account, CreateAccountDTO, UpdateAccountDTO } from '../../domain/account';

export const accountRepo = {
	async create(data: CreateAccountDTO): Promise<Account> {
		const [result] = await db.insert(account).values(data).returning();
		return result;
	},

	async findById(id: string): Promise<Account | undefined> {
		const [result] = await db
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
				currencySymbol: currency.symbol
			})
			.from(account)
			.leftJoin(currency, eq(account.currencyId, currency.id))
			.where(eq(account.id, id));
		return result;
	},

	async findAll(): Promise<Account[]> {
		return await db
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
				currencySymbol: currency.symbol
			})
			.from(account)
			.leftJoin(currency, eq(account.currencyId, currency.id));
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
