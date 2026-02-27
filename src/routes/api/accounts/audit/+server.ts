import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';

/**
 * GET /api/accounts/audit
 *
 * Get the full audit trail for all user accounts.
 * Returns all events ordered by time for compliance and debugging.
 *
 * Query params:
 * - limit: number - max events to return (default 100)
 * - eventType: string - filter by event type
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const rawLimit = url.searchParams.get('limit');
	const limit = rawLimit === null ? 100 : Number.parseInt(rawLimit, 10);
	const eventType = url.searchParams.get('eventType');

	// Validate limit parameter
	if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
		return json(
			{ error: 'Invalid "limit" parameter. Must be an integer between 1 and 1000.' },
			{ status: 400 }
		);
	}

	try {
		// Get filtered events for this user directly from the database
		const events = await eventStoreRepo.getEventsByUserFiltered(locals.user.id, {
			eventType: eventType ?? undefined,
			limit
		});

		// Format for response
		const auditTrail = events.map((event) => ({
			id: event.id,
			streamId: event.streamId,
			streamType: event.streamType,
			eventType: event.eventType,
			version: event.version,
			occurredAt: event.occurredAt.toISOString(),
			payload: event.payload,
			metadata: event.metadata
		}));

		return json({
			count: auditTrail.length,
			events: auditTrail
		});
	} catch (error) {
		console.error('Error fetching audit trail:', error);

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
