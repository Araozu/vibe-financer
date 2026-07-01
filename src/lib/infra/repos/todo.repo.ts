import { and, asc, eq, max } from 'drizzle-orm';
import { db } from '../db';
import { todoItem } from '../db/schema';
import type { CreateTodoItemDTO, UpdateTodoItemDTO } from '$lib/domain/todo';

export const todoRepo = {
	async getByUser(userId: string) {
		return db
			.select()
			.from(todoItem)
			.where(eq(todoItem.userId, userId))
			.orderBy(asc(todoItem.completed), asc(todoItem.sortOrder), asc(todoItem.createdAt));
	},

	async getNextSortOrder(userId: string): Promise<number> {
		const [result] = await db
			.select({ maxSortOrder: max(todoItem.sortOrder) })
			.from(todoItem)
			.where(eq(todoItem.userId, userId));
		return (result?.maxSortOrder ?? -1) + 1;
	},

	async create(data: CreateTodoItemDTO) {
		const [created] = await db
			.insert(todoItem)
			.values({
				userId: data.userId,
				title: data.title,
				sortOrder: data.sortOrder ?? 0
			})
			.returning();
		return created;
	},

	async update(userId: string, id: string, data: UpdateTodoItemDTO) {
		const [updated] = await db
			.update(todoItem)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(todoItem.id, id), eq(todoItem.userId, userId)))
			.returning();
		return updated ?? null;
	},

	async delete(userId: string, id: string): Promise<boolean> {
		const deleted = await db
			.delete(todoItem)
			.where(and(eq(todoItem.id, id), eq(todoItem.userId, userId)))
			.returning({ id: todoItem.id });
		return deleted.length > 0;
	}
};
