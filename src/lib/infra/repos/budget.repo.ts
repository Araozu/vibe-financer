/**
 * Budget Repository
 * 
 * Handles queries for budget projections.
 */

import { db } from '../db';
import { budget, currency } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const budgetRepo = {
    /**
     * Get all budgets for a user
     */
	async getByUser(userId: string) {
		return db
			.select({
				id: budget.id,
				userId: budget.userId,
				category: budget.category,
				limit: budget.limit,
				currencyId: budget.currencyId,
				period: budget.period,
				startDate: budget.startDate,
				currentSpent: budget.currentSpent,
				createdAt: budget.createdAt,
				updatedAt: budget.updatedAt,
				currencyCode: currency.code,
				currencySymbol: currency.symbol
			})
			.from(budget)
			.leftJoin(currency, eq(budget.currencyId, currency.id))
			.where(eq(budget.userId, userId));
	},

    /**
     * Get a specific budget by ID
     */
	async getById(budgetId: string) {
		const [result] = await db
			.select({
				id: budget.id,
				userId: budget.userId,
				category: budget.category,
				limit: budget.limit,
				currencyId: budget.currencyId,
				period: budget.period,
				startDate: budget.startDate,
				currentSpent: budget.currentSpent,
				createdAt: budget.createdAt,
				updatedAt: budget.updatedAt,
				currencyCode: currency.code,
				currencySymbol: currency.symbol
			})
			.from(budget)
			.leftJoin(currency, eq(budget.currencyId, currency.id))
			.where(eq(budget.id, budgetId));
		return result ?? null;
	},

    /**
     * Get budgets by category
     */
    async getByCategory(userId: string, category: string) {
        return db.select()
            .from(budget)
            .where(and(eq(budget.userId, userId), eq(budget.category, category)));
    }
};
