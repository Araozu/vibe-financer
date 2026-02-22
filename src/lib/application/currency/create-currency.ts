import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import {
	validateCurrencyCode,
	validateCurrencyName,
	validateCurrencySymbol,
	type Currency
} from '$lib/domain/currency';
import { createCurrencyCreatedEvent, type CurrencyCreatedPayload } from '$lib/domain/events';

export interface CreateCurrencyDTO {
	userId: string;
	code: string;
	symbol: string;
	name: string;
}

export async function createCurrency(data: CreateCurrencyDTO): Promise<Currency> {
	if (!validateCurrencyCode(data.code)) {
		throw new Error('Invalid currency code (must be 3 uppercase letters)');
	}
	if (!validateCurrencySymbol(data.symbol)) {
		throw new Error('Invalid currency symbol');
	}
	if (!validateCurrencyName(data.name)) {
		throw new Error('Invalid currency name');
	}

	const existing = await eventStoreRepo.getCurrencyByCode(data.code);
	if (existing) {
		throw new Error(`Currency with code ${data.code} already exists`);
	}

	const currencyId = crypto.randomUUID();

	const payload: CurrencyCreatedPayload = {
		currencyId,
		code: data.code,
		symbol: data.symbol,
		name: data.name
	};

	const event = createCurrencyCreatedEvent(currencyId, data.userId, payload, 1);

	// Append to event store
	await eventStoreRepo.append(event);

	// Update read model (projection)
	await eventStoreRepo.createCurrencyProjection({
		id: currencyId,
		code: data.code,
		symbol: data.symbol,
		name: data.name
	});

	return {
		id: currencyId,
		code: data.code,
		symbol: data.symbol,
		name: data.name
	};
}
