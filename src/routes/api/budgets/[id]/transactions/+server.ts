import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTransactionsByBudgetPeriodPaginated } from '$lib/application/transaction/list-transactions';

function parseReferenceDate(url: URL): Date | null {
	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');

	if ((monthParam === null) !== (yearParam === null)) {
		return null;
	}

	if (monthParam === null || yearParam === null) {
		return new Date();
	}

	const month = Number.parseInt(monthParam, 10);
	const year = Number.parseInt(yearParam, 10);
	if (!Number.isFinite(month) || !Number.isFinite(year) || month < 0 || month > 11) {
		return null;
	}

	return new Date(Date.UTC(year, month, 1, 12));
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

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

	const referenceDate = parseReferenceDate(url);
	if (referenceDate === null) {
		return json({ error: 'Invalid month or year' }, { status: 400 });
	}

	try {
		const result = await listTransactionsByBudgetPeriodPaginated(
			params.id,
			locals.user.id,
			limit,
			rawOffset,
			{
				timezone: url.searchParams.get('tz') ?? 'UTC',
				referenceDate,
				search: url.searchParams.get('search')?.trim() ?? '',
				accountId: url.searchParams.get('accountId')?.trim() ?? ''
			}
		);

		return json({
			transactions: result.transactions.map((tx) => ({
				...tx,
				createdAt: tx.createdAt.toISOString(),
				updatedAt: tx.updatedAt.toISOString(),
				deletedAt: tx.deletedAt?.toISOString() ?? null
			})),
			limit,
			offset: rawOffset,
			hasMore: result.hasMore
		});
	} catch {
		return json({ error: 'Budget not found' }, { status: 404 });
	}
};
