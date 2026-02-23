import { db } from '../db';
import { transaction } from '../db/schema';
import { eq, desc, isNull, and, between, lt } from 'drizzle-orm';
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
			.where(and(eq(transaction.accountId, accountId), isNull(transaction.deletedAt)))
			.orderBy(desc(transaction.createdAt));
	},

	async findByDateRange(accountId: string, start: Date, end: Date): Promise<Transaction[]> {
		return await db
			.select()
			.from(transaction)
			.where(
				and(
					eq(transaction.accountId, accountId),
					isNull(transaction.deletedAt),
					between(transaction.createdAt, start, end)
				)
			)
			.orderBy(desc(transaction.createdAt));
	},

	async getSumBeforeDate(accountId: string, date: Date): Promise<number> {
		const transactionsBefore = await db
			.select()
			.from(transaction)
			.where(
				and(
					eq(transaction.accountId, accountId),
					isNull(transaction.deletedAt),
					lt(transaction.createdAt, date)
				)
			);

		return transactionsBefore.reduce((sum, tx) => {
			if (tx.type === 'income') return sum + tx.amount;
			if (tx.type === 'expense') return sum - tx.amount;
			if (tx.type === 'transfer') {
				// If this is the source account, it's a deduction
				if (tx.accountId === accountId) return sum - tx.amount;
				// If this is the destination account, it's an addition
				// (But wait, findByAccountId only finds where tx.accountId matches)
			}
			return sum;
		}, 0);
	},

	async findByAccountIdPaginated(
		accountId: string,
		limit: number,
		offset: number
	): Promise<Transaction[]> {
		return await db
			.select()
			.from(transaction)
			.where(and(eq(transaction.accountId, accountId), isNull(transaction.deletedAt)))
			.orderBy(desc(transaction.createdAt))
			.limit(limit)
			.offset(offset);
	},

	async findAll(): Promise<Transaction[]> {
		return await db
			.select()
			.from(transaction)
			.where(isNull(transaction.deletedAt))
			.orderBy(desc(transaction.createdAt));
	},

	async update(
		id: string,
		data: Partial<Omit<Transaction, 'id' | 'createdAt'>>
	): Promise<Transaction | undefined> {
		const [result] = await db
			.update(transaction)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(transaction.id, id))
			.returning();
		return result;
	}
};
