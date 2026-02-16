/**
 * Budget Repository
 * 
 * Handles queries for budget projections.
 */

import { db } from '../db';
import { budget } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const budgetRepo = {
    /**
     * Get all budgets for a user
     */
    async getByUser(userId: string) {
        return db.select().from(budget).where(eq(budget.userId, userId));
    },

    /**
     * Get a specific budget by ID
     */
    async getById(budgetId: string) {
        const [result] = await db.select().from(budget).where(eq(budget.id, budgetId));
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
