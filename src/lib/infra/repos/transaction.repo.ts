import { db } from '../db';
import { transaction } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import type { Transaction, CreateTransactionDTO } from '../../domain/transaction';

export const transactionRepo = {
	async create(data: CreateTransactionDTO): Promise<Transaction> {
		const [result] = await db.insert(transaction).values(data).returning();
		return result;
	},

	async findById(id: string): Promise<Transaction | undefined> {
		const [result] = await db.select().from(transaction).where(eq(transaction.id, id));
		return result;
	},

	async findByAccountId(accountId: string): Promise<Transaction[]> {
		return await db
			.select()
			.from(transaction)
			.where(eq(transaction.accountId, accountId))
			.orderBy(desc(transaction.createdAt));
	},

	async findAll(): Promise<Transaction[]> {
		return await db.select().from(transaction).orderBy(desc(transaction.createdAt));
	}
};
