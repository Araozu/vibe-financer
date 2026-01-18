import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBalanceAt,
	getBalanceHistory,
	getFullBalanceHistory,
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
				currencyCode: accountWithHistory.currencyCode,
				currencySymbol: accountWithHistory.currencySymbol
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
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
