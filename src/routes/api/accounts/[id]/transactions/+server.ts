import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	listTransactionsByAccountPaginated,
	type TransactionTimeframe
} from '$lib/application/transaction/list-transactions';
import { getAccountState } from '$lib/application/account/list-accounts';
import type { TransactionType } from '$lib/domain/transaction';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const accountId = params.id;
	const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
	const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
	const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

	if (!Number.isFinite(rawOffset) || rawOffset < 0) {
		return json({ error: 'Invalid offset' }, { status: 400 });
	}

	const MAX_OFFSET = 10_000;
	if (rawOffset > MAX_OFFSET) {
		return json({ error: `Offset must not exceed ${MAX_OFFSET}` }, { status: 400 });
	}

	const offset = rawOffset;
	const search = url.searchParams.get('search')?.trim() ?? '';
	const category = url.searchParams.get('category')?.trim() ?? '';
	const requestedType = url.searchParams.get('type') ?? 'all';
	const requestedTimeframe = url.searchParams.get('timeframe') ?? 'all';

	const type =
		requestedType === 'income' ||
		requestedType === 'expense' ||
		requestedType === 'transfer' ||
		requestedType === 'all'
			? (requestedType as TransactionType | 'all')
			: 'all';

	const timeframeValues: TransactionTimeframe[] = [
		'all',
		'7d',
		'30d',
		'90d',
		'this-month',
		'last-month',
		'this-year'
	];
	const timeframe = timeframeValues.includes(requestedTimeframe as TransactionTimeframe)
		? (requestedTimeframe as TransactionTimeframe)
		: 'all';

	// Verify account belongs to user
	const account = await getAccountState(accountId);
	if (!account || account.userId !== locals.user.id) {
		return json({ error: 'Account not found' }, { status: 404 });
	}

	const transactions = await listTransactionsByAccountPaginated(accountId, limit, offset, {
		search,
		category,
		type,
		timeframe
	});

	return json({
		transactions: transactions.map((tx) => ({
			...tx,
			createdAt: tx.createdAt.toISOString(),
			updatedAt: tx.updatedAt.toISOString()
		})),
		limit,
		offset,
		hasMore: transactions.length === limit
	});
};
