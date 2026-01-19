import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBalanceSnapshotAt,
	getNetWorthOverTime,
	compareBalances
} from '$lib/application/balance/balance-history';

/**
 * GET /api/accounts/net-worth
 *
 * Get net worth (sum of all account balances) for the user.
 * Supports historical queries and comparisons.
 *
 * Query params:
 * - asOf: ISO date string - get net worth at specific time
 * - startDate: ISO date string - start of range for trend
 * - endDate: ISO date string - end of range for trend
 * - interval: number - days between snapshots (default 1)
 * - compareDate: ISO date string - compare current to this date
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const asOf = url.searchParams.get('asOf');
	const startDate = url.searchParams.get('startDate');
	const endDate = url.searchParams.get('endDate');
	const intervalParam = url.searchParams.get('interval');
	const compareDate = url.searchParams.get('compareDate');

	// Validate interval parameter
	const interval = intervalParam === null ? 1 : parseInt(intervalParam, 10);
	if (!Number.isFinite(interval) || Number.isNaN(interval) || interval <= 0) {
		return json({ error: 'Invalid interval parameter; must be a positive integer' }, { status: 400 });
	}

	// Validate date parameters
	if (asOf && isNaN(new Date(asOf).getTime())) {
		return json({ error: 'Invalid asOf parameter; must be a valid ISO date string' }, { status: 400 });
	}
	if (startDate && isNaN(new Date(startDate).getTime())) {
		return json({ error: 'Invalid startDate parameter; must be a valid ISO date string' }, { status: 400 });
	}
	if (endDate && isNaN(new Date(endDate).getTime())) {
		return json({ error: 'Invalid endDate parameter; must be a valid ISO date string' }, { status: 400 });
	}
	if (compareDate && isNaN(new Date(compareDate).getTime())) {
		return json({ error: 'Invalid compareDate parameter; must be a valid ISO date string' }, { status: 400 });
	}

	try {
		const now = new Date();
		const response: Record<string, unknown> = {};

		// Get current net worth
		const currentSnapshot = await getBalanceSnapshotAt(locals.user.id, now);
		response.current = {
			timestamp: now.toISOString(),
			totalBalance: currentSnapshot.totalBalance,
			accounts: currentSnapshot.accounts
		};

		// Get net worth at specific time
		if (asOf) {
			const asOfDate = new Date(asOf);
			const snapshot = await getBalanceSnapshotAt(locals.user.id, asOfDate);
			response.asOf = {
				timestamp: asOfDate.toISOString(),
				totalBalance: snapshot.totalBalance,
				accounts: snapshot.accounts
			};
		}

		// Get net worth trend over time
		if (startDate && endDate) {
			const start = new Date(startDate);
			const end = new Date(endDate);
			const trend = await getNetWorthOverTime(locals.user.id, start, end, interval);
			response.trend = trend.map((point) => ({
				date: point.date.toISOString(),
				netWorth: point.netWorth
			}));
		}

		// Compare to a previous date
		if (compareDate) {
			const compareToDate = new Date(compareDate);
			const comparison = await compareBalances(locals.user.id, compareToDate, now);
			response.comparison = {
				from: {
					timestamp: compareToDate.toISOString(),
					totalBalance: comparison.date1Snapshot.totalBalance
				},
				to: {
					timestamp: now.toISOString(),
					totalBalance: comparison.date2Snapshot.totalBalance
				},
				netWorthChange: comparison.netWorthChange,
				accountChanges: comparison.accountChanges
			};
		}

		return json(response);
	} catch (error) {
		console.error('Error fetching net worth:', error);
		
		// Handle different error types
		if (error && typeof error === 'object') {
			const e = error as { status?: number; message?: string; name?: string };
			
			// Handle concurrency errors
			if (e.name === 'ConcurrencyError') {
				return json(
					{ error: 'Concurrent update detected. Please retry.' },
					{ status: 409 }
				);
			}
			
			// Propagate HTTP errors
			if (typeof e.status === 'number' && e.status >= 400 && e.status < 600) {
				return json(
					{ error: e.message || 'Request failed' },
					{ status: e.status }
				);
			}
		}
		
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
