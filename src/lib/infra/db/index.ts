// import { drizzle } from 'drizzle-orm/better-sqlite3';
// import Database from 'better-sqlite3';
// import { env } from '$env/dynamic/private';
// import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// const sqlite = new Database(env.DATABASE_URL);
// export const db = drizzle(sqlite);

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const sqlite = new Database(env.DATABASE_URL);
export const db = drizzle(sqlite);

// Note: Migrations are handled via drizzle-kit push/migrate commands
// Run `bun run db:push` or `bun run db:migrate` to apply schema changes