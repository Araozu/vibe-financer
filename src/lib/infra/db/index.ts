import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

console.log('DATABASE_URL: ', env.DATABASE_URL);

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL
});

export const db = drizzle(pool);
await migrate(db, { migrationsFolder: './drizzle' });
