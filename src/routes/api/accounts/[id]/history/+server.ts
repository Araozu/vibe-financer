import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBalanceAt,
	getBalanceHistory,
	getAuditTrail
} from '$lib/application/balance/balance-history';
import { getAccountWithHistory } from '$lib/application/account/account-projection';

/**
 * GET /api/accounts/[id]/history
 *
 * Get the balance history and audit trail for an account.
 * Supports time-travel queries via query parameters.
 *
 * Query params:
 * - asOf: ISO date string - get balance at specific time
 * - startDate: ISO date string - start of range
 * - endDate: ISO date string - end of range
 * - includeAudit: boolean - include full audit trail
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const accountId = params.id;
	const asOf = url.searchParams.get('asOf');
	const startDate = url.searchParams.get('startDate');
	const endDate = url.searchParams.get('endDate');
	const includeAudit = url.searchParams.get('includeAudit') === 'true';

	// Validate date parameters
	if (asOf && isNaN(new Date(asOf).getTime())) {
		return json(
			{ error: 'Invalid asOf parameter; must be a valid ISO date string' },
			{ status: 400 }
		);
	}
	if (startDate && isNaN(new Date(startDate).getTime())) {
		return json(
			{ error: 'Invalid startDate parameter; must be a valid ISO date string' },
			{ status: 400 }
		);
	}
	if (endDate && isNaN(new Date(endDate).getTime())) {
		return json(
			{ error: 'Invalid endDate parameter; must be a valid ISO date string' },
			{ status: 400 }
		);
	}

	try {
		// Get account with full history
		const accountWithHistory = await getAccountWithHistory(accountId);

		if (!accountWithHistory) {
			return json({ error: 'Account not found' }, { status: 404 });
		}

		// Verify ownership
		if (accountWithHistory.userId !== locals.user.id) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const response: Record<string, unknown> = {
			account: {
				id: accountWithHistory.id,
				name: accountWithHistory.name,
				type: accountWithHistory.type,
				currentBalance: accountWithHistory.currentBalance,
				currencyId: accountWithHistory.currencyId
			}
		};

		// If specific point in time requested
		if (asOf) {
			const asOfDate = new Date(asOf);
			const balance = await getBalanceAt(accountId, asOfDate);
			response.balanceAtTime = {
				timestamp: asOfDate.toISOString(),
				balance
			};
		}

		// If date range requested
		if (startDate && endDate) {
			const start = new Date(startDate);
			const end = new Date(endDate);
			const history = await getBalanceHistory(accountId, start, end);
			response.balanceHistory = history.map((h) => ({
				...h,
				timestamp: h.timestamp.toISOString()
			}));
		} else {
			// Return full history
			response.balanceHistory = accountWithHistory.balanceHistory.map((h) => ({
				...h,
				timestamp: h.timestamp.toISOString()
			}));
		}

		// Include audit trail if requested
		if (includeAudit) {
			const auditTrail = await getAuditTrail(accountId);
			response.auditTrail = auditTrail.map((entry) => ({
				...entry,
				occurredAt: entry.occurredAt.toISOString()
			}));
		}

		return json(response);
	} catch (error) {
		console.error('Error fetching account history:', error);

		// Handle different error types
		if (error && typeof error === 'object') {
			const e = error as { status?: number; message?: string };

			// Propagate HTTP errors
			if (typeof e.status === 'number' && e.status >= 400 && e.status < 600) {
				return json({ error: e.message || 'Request failed' }, { status: e.status });
			}
		}

		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
