import { db } from '../db';
import { user } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { User, CreateUserDTO, UpdateUserDTO } from '../../domain/user';

export const userRepo = {
	async create(data: CreateUserDTO): Promise<User> {
		const [result] = await db.insert(user).values(data).returning();
		return result;
	},

	async update(id: string, data: UpdateUserDTO): Promise<User | undefined> {
		const [result] = await db
			.update(user)
			.set(data)
			.where(eq(user.id, id))
			.returning();
		return result;
	},

	async findById(id: string): Promise<User | undefined> {
		const [result] = await db.select().from(user).where(eq(user.id, id));
		return result;
	},

	async findByEmail(email: string): Promise<User | undefined> {
		const [result] = await db.select().from(user).where(eq(user.email, email));
		return result;
	},

	async findAll(): Promise<User[]> {
		return await db.select().from(user);
	}
};
