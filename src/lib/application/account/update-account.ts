import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { getAccountState, getAccountVersion } from './account-projection';
import { validateAccountName, type UpdateAccountDTO, type Account } from '$lib/domain/account';
import { createAccountUpdatedEvent, type AccountUpdatedPayload } from '$lib/domain/events';
import { error } from '@sveltejs/kit';

/**
 * Update an account's details and persist changes as an AccountUpdated event.
 *
 * @param id - The account ID to update
 * @param data - The fields to update (only changed fields are persisted)
 * @param userId - The ID of the user making the change (required for event sourcing audit trails)
 * @returns The updated account with new values
 *
 * The userId parameter is required for event sourcing to maintain a complete audit trail
 * of who made each change. All events in the event store must be attributed to a user
 * for compliance and debugging purposes.
 */
export async function updateAccount(
	id: string,
	data: UpdateAccountDTO,
	userId: string
): Promise<Account> {
	if (data.name !== undefined && !validateAccountName(data.name)) {
		throw new Error('Invalid account name');
	}

	if (data.currencyId !== undefined) {
		const currency = await eventStoreRepo.getCurrencyById(data.currencyId);
		if (!currency) {
			throw new Error('Currency not found');
		}
	}

	// Get current state from event stream
	const currentState = await getAccountState(id);
	if (!currentState) {
		throw new Error('Account not found');
	}

	if (currentState.isDeleted) {
		throw new Error('Account has been deleted');
	}

	// Build the changes and previous values for the event
	const changes: AccountUpdatedPayload['changes'] = {};
	const previousValues: AccountUpdatedPayload['previousValues'] = {};

	if (data.name !== undefined && data.name !== currentState.name) {
		changes.name = data.name;
		previousValues.name = currentState.name;
	}
	if (data.description !== undefined && data.description !== currentState.description) {
		changes.description = data.description;
		previousValues.description = currentState.description;
	}
	if (data.type !== undefined && data.type !== currentState.type) {
		changes.type = data.type;
		previousValues.type = currentState.type;
	}
	if (data.initialBalance !== undefined && data.initialBalance !== currentState.initialBalance) {
		changes.initialBalance = data.initialBalance;
		previousValues.initialBalance = currentState.initialBalance;
	}
	if (data.currencyId !== undefined && data.currencyId !== currentState.currencyId) {
		changes.currencyId = data.currencyId;
		previousValues.currencyId = currentState.currencyId;
	}
	if (data.color !== undefined && data.color !== currentState.color) {
		changes.color = data.color;
		previousValues.color = currentState.color;
	}

	// If no changes, return current state
	if (Object.keys(changes).length === 0) {
		return {
			id: currentState.id,
			userId: currentState.userId,
			name: currentState.name,
			description: currentState.description,
			type: currentState.type,
			initialBalance: currentState.initialBalance,
			currentBalance: currentState.currentBalance,
			currencyId: currentState.currencyId,
			color: currentState.color,
			createdAt: currentState.createdAt,
			updatedAt: currentState.updatedAt
		};
	}

	// Get current version for optimistic concurrency
	const currentVersion = await getAccountVersion(id);
	const newVersion = currentVersion + 1;

	// Create the update event
	const payload: AccountUpdatedPayload = { changes, previousValues };
	const event = createAccountUpdatedEvent(id, userId, payload, newVersion);

	// Append to event store with optimistic concurrency check
	try {
		await eventStoreRepo.append(event, { expectedVersion: currentVersion });
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw error(409, 'Concurrent update detected while updating account. Please retry.');
		}
		throw err;
	}

	// Calculate new balance if initial balance changed
	let newBalance = currentState.currentBalance;
	if (changes.initialBalance !== undefined) {
		const diff =
			changes.initialBalance - (previousValues.initialBalance ?? currentState.initialBalance);
		newBalance = currentState.currentBalance + diff;
	}

	// Update read model (projection)
	await eventStoreRepo.updateAccountProjection(id, {
		...changes,
		currentBalance: newBalance
	});

	// Return updated account
	return {
		id: currentState.id,
		userId: currentState.userId,
		name: changes.name ?? currentState.name,
		description: changes.description !== undefined ? changes.description : currentState.description,
		type: changes.type ?? currentState.type,
		initialBalance: changes.initialBalance ?? currentState.initialBalance,
		currentBalance: newBalance,
		currencyId: changes.currencyId ?? currentState.currencyId,
		color: changes.color ?? currentState.color,
		createdAt: currentState.createdAt,
		updatedAt: event.occurredAt
	};
}
