import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAccountsByUser } from '$lib/application/account/list-accounts';
import { listTransactionsByAccountIds } from '$lib/application/transaction/list-transactions';
import { listTransactionsForMonthForAccounts } from '$lib/application/transaction/list-transactions';
import { createTransaction } from '$lib/application/transaction/create-transaction';
import type { TransactionType } from '$lib/domain/transaction';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');
	const limitParam = url.searchParams.get('limit');
	const timezone = url.searchParams.get('tz') ?? 'UTC';

	const accounts = await listAccountsByUser(locals.user.id);
	const accountIds = accounts.map((acc) => acc.id);

	if (monthParam !== null && yearParam !== null) {
		const month = parseInt(monthParam);
		const year = parseInt(yearParam);
		const limit = limitParam ? parseInt(limitParam) : undefined;

		if (!Number.isFinite(month) || !Number.isFinite(year)) {
			return json({ error: 'Invalid month or year' }, { status: 400 });
		}
		if (limit !== undefined && !Number.isFinite(limit)) {
			return json({ error: 'Invalid limit' }, { status: 400 });
		}

		const { transactions, initialBalances } = await listTransactionsForMonthForAccounts(
			accountIds,
			month,
			year,
			timezone,
			limit
		);

		return json({
			transactions: transactions.map((tx) => ({
				...tx,
				createdAt: tx.createdAt.toISOString(),
				updatedAt: tx.updatedAt.toISOString()
			})),
			initialBalances
		});
	}

	const transactions = await listTransactionsByAccountIds(accountIds);

	const serializedTransactions = transactions.map((tx) => ({
		...tx,
		createdAt: tx.createdAt.toISOString(),
		updatedAt: tx.updatedAt.toISOString()
	}));

	return json(serializedTransactions);
};

/**
 * POST /api/transactions
 *
 * JSON transaction creation for native clients. Body:
 * {
 *   accountId: string, type: 'expense' | 'income' | 'transfer',
 *   amount: number (major currency units, e.g. 12.50),
 *   name?: string | null, description?: string | null,
 *   category?: string | null, payee?: string | null,
 *   toAccountId?: string | null, exchangeRate?: number | null,
 *   createdAt?: ISO date string (defaults to now)
 * }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const accountId = body.accountId;
	const type = body.type;
	const amountRaw = body.amount;

	if (typeof accountId !== 'string' || !accountId) {
		return json({ error: 'accountId is required' }, { status: 400 });
	}
	if (type !== 'expense' && type !== 'income' && type !== 'transfer') {
		return json({ error: 'type must be expense, income or transfer' }, { status: 400 });
	}
	const amountNumber = typeof amountRaw === 'string' ? parseFloat(amountRaw) : amountRaw;
	if (typeof amountNumber !== 'number' || !Number.isFinite(amountNumber) || amountNumber <= 0) {
		return json({ error: 'amount must be a positive number' }, { status: 400 });
	}

	const strOrNull = (v: unknown): string | null =>
		typeof v === 'string' && v !== '' ? v : null;

	let createdAt: Date | undefined;
	if (body.createdAt != null) {
		const parsed = new Date(String(body.createdAt));
		if (Number.isNaN(parsed.getTime())) {
			return json({ error: 'createdAt must be a valid ISO date string' }, { status: 400 });
		}
		createdAt = parsed;
	}

	try {
		const transaction = await createTransaction(
			{
				accountId,
				type: type as TransactionType,
				amount: Math.round(amountNumber * 100),
				name: strOrNull(body.name),
				description: strOrNull(body.description),
				category: strOrNull(body.category),
				budgetId: null,
				payee: strOrNull(body.payee),
				toAccountId: strOrNull(body.toAccountId),
				exchangeRate:
					typeof body.exchangeRate === 'number' && Number.isFinite(body.exchangeRate)
						? body.exchangeRate
						: null,
				...(createdAt ? { createdAt } : {}),
				deletedAt: null
			},
			locals.user.id
		);
		return json(
			{
				...transaction,
				createdAt: transaction.createdAt.toISOString(),
				updatedAt: transaction.updatedAt.toISOString()
			},
			{ status: 201 }
		);
	} catch (error: unknown) {
		if (error && typeof error === 'object') {
			const e = error as { status?: number; body?: { message?: string }; message?: string };
			if (typeof e.status === 'number' && e.status >= 400 && e.status < 600) {
				return json({ error: e.body?.message ?? e.message ?? 'Request failed' }, { status: e.status });
			}
		}
		console.error('Error creating transaction:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
