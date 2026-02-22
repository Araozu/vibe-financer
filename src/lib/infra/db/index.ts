import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL
});

export const db = drizzle(pool);
