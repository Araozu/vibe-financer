/**
 * One-time script: set transaction.budget_id by matching budget.category + user,
 * preferring budget.currency_id = account.currency_id when multiple budgets share a category.
 *
 * Run from repo root (loads .env via Bun):
 *   bun run src/lib/infra/db/backfill-budget-ids.ts
 */
import pg from 'pg';

type TxRow = { id: string; category: string; user_id: string; currency_id: string };
type BudRow = { id: string; user_id: string; category: string; currency_id: string };

async function main() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error('DATABASE_URL is required');
		process.exit(1);
	}

	const pool = new pg.Pool({ connectionString: url });

	const { rows: txs } = await pool.query<TxRow>(`
		SELECT t.id, t.category, a.user_id AS user_id, a.currency_id AS currency_id
		FROM "transaction" t
		INNER JOIN account a ON a.id = t.account_id
		WHERE t.budget_id IS NULL
			AND t.category IS NOT NULL
			AND trim(t.category) <> ''
	`);

	const { rows: budgets } = await pool.query<BudRow>(`
		SELECT id, user_id, category, currency_id FROM budget
	`);

	let updated = 0;
	for (const t of txs) {
		const matches = budgets.filter((b) => b.user_id === t.user_id && b.category === t.category);
		if (matches.length === 0) continue;
		const chosen =
			matches.length === 1
				? matches[0]
				: (matches.find((b) => b.currency_id === t.currency_id) ?? matches[0]);
		if (!chosen) continue;
		await pool.query(`UPDATE "transaction" SET budget_id = $1 WHERE id = $2`, [chosen.id, t.id]);
		updated++;
	}

	await pool.end();
	console.log(`Backfill complete: matched ${updated} of ${txs.length} candidate transactions.`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
