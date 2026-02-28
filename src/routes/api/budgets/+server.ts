import { budgetRepo } from '$lib/infra/repos/budget.repo';
import { transactionRepo } from '$lib/infra/repos/transaction.repo';
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
	const budgets = await budgetRepo.getByUser(locals.user.id);
	const now = new Date();

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
		const { start, end } = getPeriodRange(period, now, timezone);
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
