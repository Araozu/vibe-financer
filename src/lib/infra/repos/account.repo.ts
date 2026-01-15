import { db } from '../db';
import { account } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Account, CreateAccountDTO, UpdateAccountDTO } from '../../domain/account';

export const accountRepo = {
	async create(data: CreateAccountDTO): Promise<Account> {
		const [result] = await db.insert(account).values(data).returning();
		return result;
	},

	async findById(id: string): Promise<Account | undefined> {
		const [result] = await db.select().from(account).where(eq(account.id, id));
		return result;
	},

	async findAll(): Promise<Account[]> {
		return await db.select().from(account);
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
