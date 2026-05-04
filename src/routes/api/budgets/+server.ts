import { budgetRepo } from '$lib/infra/repos/budget.repo';
import { transactionRepo } from '$lib/infra/repos/transaction.repo';
import { createBudget } from '$lib/application/budget/create-budget';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

function getPeriodRange(
	period: 'monthly' | 'weekly' | 'yearly',
	now: Date,
	timezone: string
): { start: Date; end: Date } {
	const zonedNow = toZonedTime(now, timezone);
	let startLocal: Date;
	let endLocal: Date;
	switch (period) {
		case 'weekly':
			startLocal = startOfWeek(zonedNow, { weekStartsOn: 1 });
			endLocal = endOfWeek(zonedNow, { weekStartsOn: 1 });
			break;
		case 'yearly':
			startLocal = startOfYear(zonedNow);
			endLocal = endOfYear(zonedNow);
			break;
		case 'monthly':
		default:
			startLocal = startOfMonth(zonedNow);
			endLocal = endOfMonth(zonedNow);
			break;
	}
	return {
		start: fromZonedTime(startLocal, timezone),
		end: fromZonedTime(endLocal, timezone)
	};
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const timezone = url.searchParams.get('tz') ?? 'UTC';
	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');

	if ((monthParam === null) !== (yearParam === null)) {
		return json({ error: 'month and year must be provided together' }, { status: 400 });
	}

	let referenceDate = new Date();
	if (monthParam !== null && yearParam !== null) {
		const month = parseInt(monthParam);
		const year = parseInt(yearParam);

		if (!Number.isFinite(month) || !Number.isFinite(year) || month < 0 || month > 11) {
			return json({ error: 'Invalid month or year' }, { status: 400 });
		}

		// Use noon UTC to avoid crossing calendar boundaries when converting to the target timezone.
		referenceDate = new Date(Date.UTC(year, month, 1, 12));
	}

	const budgets = await budgetRepo.getByUser(locals.user.id);

	// Group budgets by (currencyId, period) to batch queries
	const groupedBudgets = new Map<string, typeof budgets>();
	for (const b of budgets) {
		const key = `${b.currencyId}::${b.period}`;
		const group = groupedBudgets.get(key) ?? [];
		group.push(b);
		groupedBudgets.set(key, group);
	}

	// For each group, compute spending for the period
	const periodSpentMap = new Map<string, number>();
	for (const [key, group] of groupedBudgets) {
		const [currencyId, period] = key.split('::') as [string, 'monthly' | 'weekly' | 'yearly'];
		const { start, end } = getPeriodRange(period, referenceDate, timezone);
		const spentByCategory = await transactionRepo.sumExpensesByCategoryForUser(
			locals.user.id,
			currencyId,
			start,
			end
		);
		for (const b of group) {
			periodSpentMap.set(b.id, spentByCategory.get(b.category) ?? 0);
		}
	}

	const result = budgets.map((b) => ({
		...b,
		periodSpent: periodSpentMap.get(b.id) ?? 0
	}));

	return json(result);
};

const PERIODS = new Set(['monthly', 'weekly', 'yearly']);

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (typeof body !== 'object' || body === null) {
		return json({ error: 'Expected JSON object' }, { status: 400 });
	}

	const o = body as Record<string, unknown>;
	const category = typeof o.category === 'string' ? o.category.trim() : '';
	if (!category) {
		return json({ error: 'category is required' }, { status: 400 });
	}

	const currencyId = typeof o.currencyId === 'string' ? o.currencyId : '';
	if (!currencyId) {
		return json({ error: 'currencyId is required' }, { status: 400 });
	}

	const limit = typeof o.limit === 'number' && Number.isFinite(o.limit) ? Math.round(o.limit) : 0;
	const periodRaw = typeof o.period === 'string' ? o.period : 'monthly';
	const period = PERIODS.has(periodRaw)
		? (periodRaw as 'monthly' | 'weekly' | 'yearly')
		: 'monthly';

	let startDate: Date;
	if (typeof o.startDate === 'string' && o.startDate.length > 0) {
		const d = new Date(o.startDate);
		if (Number.isNaN(d.getTime())) {
			return json({ error: 'Invalid startDate' }, { status: 400 });
		}
		startDate = d;
	} else {
		startDate = new Date();
	}

	try {
		const created = await createBudget({
			userId: locals.user.id,
			category,
			limit,
			currencyId,
			period,
			startDate
		});
		return json({
			id: created.id,
			userId: created.userId,
			category: created.category,
			limit: created.limit,
			currencyId: created.currencyId,
			period: created.period,
			startDate: created.startDate,
			currentSpent: created.currentSpent,
			createdAt: created.createdAt,
			updatedAt: created.updatedAt
		});
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Failed to create budget';
		return json({ error: message }, { status: 400 });
	}
};
