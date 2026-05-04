import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	listTransactionsByBudgetPeriodPaginated,
	getBudgetPeriodRange
} from '$lib/application/transaction/list-transactions';
import { listAccountsByUser } from '$lib/application/account/list-accounts';
import { updateBudget } from '$lib/application/budget/update-budget';
import { parseDateAsUTC, toUTC } from '$lib/domain/date-formatter';

const PERIODS = new Set(['monthly', 'weekly', 'yearly']);

export const load: PageServerLoad = async ({ params, locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');
	let referenceDate = new Date();

	if ((monthParam === null) !== (yearParam === null)) {
		throw error(400, 'month and year must be provided together');
	}

	if (monthParam !== null && yearParam !== null) {
		const month = Number.parseInt(monthParam, 10);
		const year = Number.parseInt(yearParam, 10);
		if (!Number.isFinite(month) || !Number.isFinite(year) || month < 0 || month > 11) {
			throw error(400, 'Invalid month or year');
		}
		referenceDate = new Date(Date.UTC(year, month, 1, 12));
	}

	const timezone = url.searchParams.get('tz') ?? 'UTC';

	try {
		const [budgetResult, accounts] = await Promise.all([
			listTransactionsByBudgetPeriodPaginated(params.id, locals.user.id, 50, 0, {
				timezone,
				referenceDate,
				search: ''
			}),
			listAccountsByUser(locals.user.id)
		]);
		const periodRange = getBudgetPeriodRange(budgetResult.budget.period, referenceDate, timezone);

		return {
			budget: {
				...budgetResult.budget,
				periodSpent: budgetResult.periodSpent,
				periodStart: periodRange.start.toISOString(),
				periodEnd: periodRange.end.toISOString(),
				startDate: budgetResult.budget.startDate.toISOString(),
				createdAt: budgetResult.budget.createdAt.toISOString(),
				updatedAt: budgetResult.budget.updatedAt.toISOString()
			},
			initialTransactions: budgetResult.transactions.map((tx) => ({
				...tx,
				createdAt: tx.createdAt.toISOString(),
				updatedAt: tx.updatedAt.toISOString(),
				deletedAt: tx.deletedAt?.toISOString() ?? null
			})),
			accounts: accounts.map((account) => ({
				id: account.id,
				name: account.name,
				color: account.color,
				currencyId: account.currencyId,
				currencyCode: account.currencyCode ?? null,
				currencySymbol: account.currencySymbol ?? null
			})),
			hasMore: budgetResult.hasMore
		};
	} catch {
		throw error(404, 'Budget not found');
	}
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const budgetId = formData.get('budgetId') as string;
		if (!budgetId?.trim()) {
			return fail(400, { error: 'budgetId is required' });
		}

		const category = formData.get('category') as string;
		const limitStr = formData.get('limit') as string;
		const periodRaw = formData.get('period') as string;
		const startDateStr = formData.get('startDate') as string;

		const parsedLimit = Number.parseFloat(limitStr);
		const limit = Number.isNaN(parsedLimit) ? 0 : Math.round(parsedLimit * 100);
		const period = PERIODS.has(periodRaw)
			? (periodRaw as 'monthly' | 'weekly' | 'yearly')
			: 'monthly';
		const startDate = startDateStr ? parseDateAsUTC(startDateStr) : toUTC(new Date());

		try {
			await updateBudget(budgetId.trim(), locals.user.id, {
				category,
				limit,
				period,
				startDate
			});
			return { success: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			return fail(400, { error: message });
		}
	}
};
