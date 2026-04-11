import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import {
	validateCurrencyCode,
	validateCurrencyName,
	validateCurrencySymbol,
	type Currency
} from '$lib/domain/currency';
import { projectCurrencyState } from '$lib/domain/currency-aggregate';
import { createCurrencyUpdatedEvent, type CurrencyUpdatedPayload } from '$lib/domain/events';
import { error } from '@sveltejs/kit';

export interface UpdateCurrencyDTO {
	code?: string;
	symbol?: string;
	name?: string;
}

export async function updateCurrency(
	currencyId: string,
	data: UpdateCurrencyDTO,
	userId: string
): Promise<Currency> {
	if (data.code !== undefined && !validateCurrencyCode(data.code)) {
		throw new Error('Invalid currency code (must be 3 uppercase letters)');
	}
	if (data.symbol !== undefined && !validateCurrencySymbol(data.symbol)) {
		throw new Error('Invalid currency symbol');
	}
	if (data.name !== undefined && !validateCurrencyName(data.name)) {
		throw new Error('Invalid currency name');
	}

	// Check for duplicate code if code is being changed
	if (data.code !== undefined) {
		const existing = await eventStoreRepo.getCurrencyByCode(data.code);
		if (existing && existing.id !== currencyId) {
			throw new Error(`Currency with code ${data.code} already exists`);
		}
	}

	// Get current state from event stream
	const events = await eventStoreRepo.getStream(currencyId);
	const currentState = projectCurrencyState(events);
	if (!currentState) {
		throw new Error('Currency not found');
	}

	if (currentState.isDeleted) {
		throw new Error('Currency has been deleted');
	}

	// Build changes and previous values
	const changes: CurrencyUpdatedPayload['changes'] = {};
	const previousValues: CurrencyUpdatedPayload['previousValues'] = {};

	if (data.code !== undefined && data.code !== currentState.code) {
		changes.code = data.code;
		previousValues.code = currentState.code;
	}
	if (data.symbol !== undefined && data.symbol !== currentState.symbol) {
		changes.symbol = data.symbol;
		previousValues.symbol = currentState.symbol;
	}
	if (data.name !== undefined && data.name !== currentState.name) {
		changes.name = data.name;
		previousValues.name = currentState.name;
	}

	// If no changes, return current state
	if (Object.keys(changes).length === 0) {
		return {
			id: currentState.id,
			code: currentState.code,
			symbol: currentState.symbol,
			name: currentState.name
		};
	}

	// Get current version for optimistic concurrency
	const currentVersion = await eventStoreRepo.getStreamVersion(currencyId);
	const newVersion = currentVersion + 1;

	// Create the update event
	const payload: CurrencyUpdatedPayload = { changes, previousValues };
	const event = createCurrencyUpdatedEvent(currencyId, userId, payload, newVersion);

	// Append to event store with optimistic concurrency check
	try {
		await eventStoreRepo.append(event, { expectedVersion: currentVersion });
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw error(409, 'Concurrent update detected while updating currency. Please retry.');
		}
		throw err;
	}

	// Update read model (projection)
	await eventStoreRepo.updateCurrencyProjection(currencyId, changes);

	return {
		id: currentState.id,
		code: changes.code ?? currentState.code,
		symbol: changes.symbol ?? currentState.symbol,
		name: changes.name ?? currentState.name
	};
}
