import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { projectCurrencyState } from '$lib/domain/currency-aggregate';
import { createCurrencyDeletedEvent } from '$lib/domain/events';
import { error } from '@sveltejs/kit';

export async function deleteCurrency(
	currencyId: string,
	userId: string,
	reason?: string
): Promise<void> {
	// Get current state from event stream
	const events = await eventStoreRepo.getStream(currencyId);
	const currentState = projectCurrencyState(events);
	if (!currentState) {
		throw new Error('Currency not found');
	}

	if (currentState.isDeleted) {
		throw new Error('Currency has already been deleted');
	}

	// Get current version for optimistic concurrency
	const currentVersion = await eventStoreRepo.getStreamVersion(currencyId);
	const newVersion = currentVersion + 1;

	// Create the delete event
	const event = createCurrencyDeletedEvent(currencyId, userId, { reason }, newVersion);

	// Append to event store with optimistic concurrency check
	try {
		await eventStoreRepo.append(event, { expectedVersion: currentVersion });
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw error(409, 'Concurrent update detected while deleting currency. Please retry.');
		}
		throw err;
	}

	// Delete read model (projection)
	await eventStoreRepo.deleteCurrencyProjection(currencyId);
}
