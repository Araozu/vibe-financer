import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDashboardSummary } from '$lib/application/dashboard/get-dashboard-summary';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const monthParam = url.searchParams.get('month');
	const yearParam = url.searchParams.get('year');
	const timezone = url.searchParams.get('tz') ?? 'UTC';

	if (monthParam === null || yearParam === null) {
		return json({ error: 'month and year are required' }, { status: 400 });
	}
	const month = parseInt(monthParam);
	const year = parseInt(yearParam);
	if (!Number.isFinite(month) || !Number.isFinite(year)) {
		return json({ error: 'Invalid month or year' }, { status: 400 });
	}

	const summary = await getDashboardSummary(locals.user.id, month, year, timezone);

	return json({
		...summary,
		asOf: summary.asOf.toISOString()
	});
};
