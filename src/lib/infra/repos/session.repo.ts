import { db } from '../db';
import { session } from '../db/schema';
import { eq, lte } from 'drizzle-orm';
import type { Session, CreateSessionDTO } from '../../domain/user';

export const sessionRepo = {
	async create(data: CreateSessionDTO): Promise<Session> {
		const [result] = await db.insert(session).values(data).returning();
		return result;
	},

	async findById(id: string): Promise<Session | undefined> {
		const [result] = await db.select().from(session).where(eq(session.id, id));
		return result;
	},

	async deleteById(id: string): Promise<void> {
		await db.delete(session).where(eq(session.id, id));
	},

	async deleteByUserId(userId: string): Promise<void> {
		await db.delete(session).where(eq(session.userId, userId));
	},

	async deleteExpired(): Promise<void> {
		await db.delete(session).where(lte(session.expiresAt, new Date()));
	}
};
