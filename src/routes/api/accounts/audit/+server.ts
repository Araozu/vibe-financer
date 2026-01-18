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

	const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
	const eventType = url.searchParams.get('eventType');

	try {
		// Get all events for this user
		let events = await eventStoreRepo.getEventsByUser(locals.user.id);

		// Filter by event type if specified
		if (eventType) {
			events = events.filter((e) => e.eventType === eventType);
		}

		// Apply limit
		events = events.slice(0, limit);

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
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
