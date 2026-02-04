import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { env } from '$env/dynamic/private';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// If the database is not in-memory, check if the file exists, and create it if not using Bun APIs.
if (env.DATABASE_URL !== ':memory:') {
	const exists = await Bun.file(env.DATABASE_URL).exists();
	if (!exists) {
		await Bun.write(env.DATABASE_URL, '');
	}
}

const sqlite = new Database(env.DATABASE_URL);
export const db = drizzle(sqlite);

migrate(db, { migrationsFolder: './drizzle' });
