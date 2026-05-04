import { db } from '../db';
import { transaction, account } from '../db/schema';
import {
	and,
	asc,
	between,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNull,
	lt,
	lte,
	or,
	sql
} from 'drizzle-orm';
import type { Transaction, CreateTransactionDTO, TransactionType } from '../../domain/transaction';

interface TransactionQueryFilters {
	search?: string;
	category?: string;
	type?: TransactionType;
	startDate?: Date;
	endDate?: Date;
}

interface BudgetPeriodTransactionParams {
	userId: string;
	currencyId: string;
	category: string;
	start: Date;
	end: Date;
	limit: number;
	offset: number;
	search?: string;
}

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

	async findByAccountIdsAndDateRange(
		accountIds: string[],
		start: Date,
		end: Date,
		limit?: number
	): Promise<Transaction[]> {
		if (accountIds.length === 0) return [];

		const baseQuery = db
			.select()
			.from(transaction)
			.where(
				and(
					inArray(transaction.accountId, accountIds),
					isNull(transaction.deletedAt),
					between(transaction.createdAt, start, end)
				)
			)
			.orderBy(desc(transaction.createdAt));

		return await (limit !== undefined ? baseQuery.limit(limit) : baseQuery);
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

	async findByAccountIdPaginatedFiltered(
		accountId: string,
		limit: number,
		offset: number,
		filters: TransactionQueryFilters
	): Promise<Transaction[]> {
		const conditions = [eq(transaction.accountId, accountId), isNull(transaction.deletedAt)];

		if (filters.type) {
			conditions.push(eq(transaction.type, filters.type));
		}

		if (filters.category) {
			conditions.push(eq(transaction.category, filters.category));
		}

		if (filters.startDate) {
			conditions.push(gte(transaction.createdAt, filters.startDate));
		}

		if (filters.endDate) {
			conditions.push(lte(transaction.createdAt, filters.endDate));
		}

		if (filters.search) {
			const searchTerm = `%${filters.search}%`;
			const searchConditions = [
				ilike(transaction.name, searchTerm),
				ilike(transaction.description, searchTerm),
				ilike(transaction.category, searchTerm),
				ilike(transaction.payee, searchTerm)
			] as const;

			conditions.push(or(...searchConditions) ?? searchConditions[0]);
		}

		return await db
			.select()
			.from(transaction)
			.where(and(...conditions))
			.orderBy(desc(transaction.createdAt))
			.limit(limit)
			.offset(offset);
	},

	async findBudgetPeriodTransactionsPaginated(
		params: BudgetPeriodTransactionParams
	): Promise<Transaction[]> {
		const conditions = [
			eq(account.userId, params.userId),
			eq(account.currencyId, params.currencyId),
			eq(transaction.type, 'expense'),
			eq(transaction.category, params.category),
			isNull(transaction.deletedAt),
			between(transaction.createdAt, params.start, params.end)
		];

		const normalizedSearch = params.search?.trim();
		if (normalizedSearch) {
			const searchTerm = `%${normalizedSearch}%`;
			const searchConditions = [
				ilike(transaction.name, searchTerm),
				ilike(transaction.description, searchTerm),
				ilike(transaction.category, searchTerm),
				ilike(transaction.payee, searchTerm)
			] as const;

			conditions.push(or(...searchConditions) ?? searchConditions[0]);
		}

		return await db
			.select({
				id: transaction.id,
				accountId: transaction.accountId,
				type: transaction.type,
				amount: transaction.amount,
				name: transaction.name,
				description: transaction.description,
				category: transaction.category,
				budgetId: transaction.budgetId,
				payee: transaction.payee,
				toAccountId: transaction.toAccountId,
				deletedAt: transaction.deletedAt,
				createdAt: transaction.createdAt,
				updatedAt: transaction.updatedAt
			})
			.from(transaction)
			.innerJoin(account, eq(transaction.accountId, account.id))
			.where(and(...conditions))
			.orderBy(desc(transaction.createdAt))
			.limit(params.limit)
			.offset(params.offset);
	},

	async findCategoriesByAccountId(accountId: string): Promise<string[]> {
		const rows = await db
			.select({ category: sql<string>`TRIM(${transaction.category})` })
			.from(transaction)
			.where(
				and(
					eq(transaction.accountId, accountId),
					isNull(transaction.deletedAt),
					sql`${transaction.category} IS NOT NULL`,
					sql`TRIM(${transaction.category}) <> ''`
				)
			)
			.groupBy(sql`TRIM(${transaction.category})`)
			.orderBy(asc(sql`TRIM(${transaction.category})`));

		return rows
			.map((row) => row.category)
			.filter((category): category is string => Boolean(category));
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
	},

	/**
	 * Sum expense amounts grouped by category for a user's accounts
	 * with a specific currency within a date range.
	 */
	async sumExpensesByCategoryForUser(
		userId: string,
		currencyId: string,
		start: Date,
		end: Date
	): Promise<Map<string, number>> {
		const rows = await db
			.select({
				category: transaction.category,
				total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)`
			})
			.from(transaction)
			.innerJoin(account, eq(transaction.accountId, account.id))
			.where(
				and(
					eq(account.userId, userId),
					eq(account.currencyId, currencyId),
					eq(transaction.type, 'expense'),
					isNull(transaction.deletedAt),
					between(transaction.createdAt, start, end)
				)
			)
			.groupBy(transaction.category);

		const result = new Map<string, number>();
		for (const row of rows) {
			if (row.category) {
				result.set(row.category, Number(row.total));
			}
		}
		return result;
	},

	/**
	 * Total expense amounts (cents) for a user in a currency and category from start onward.
	 * Matches budget rebuild logic for category-scoped spend.
	 */
	async sumExpenseAmountsForUserCategoryCurrencySince(
		userId: string,
		currencyId: string,
		category: string,
		since: Date
	): Promise<number> {
		const [row] = await db
			.select({
				total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)`
			})
			.from(transaction)
			.innerJoin(account, eq(transaction.accountId, account.id))
			.where(
				and(
					eq(account.userId, userId),
					eq(account.currencyId, currencyId),
					eq(transaction.type, 'expense'),
					eq(transaction.category, category),
					isNull(transaction.deletedAt),
					gte(transaction.createdAt, since)
				)
			);
		return Number(row?.total ?? 0);
	}
};
