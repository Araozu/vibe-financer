import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { validateAccountName, type CreateAccountDTO, type Account } from '$lib/domain/account';
import { createAccountCreatedEvent, type AccountCreatedPayload } from '$lib/domain/events';

export async function createAccount(data: CreateAccountDTO): Promise<Account> {
	if (!validateAccountName(data.name)) {
		throw new Error('Invalid account name');
	}

	const currency = await eventStoreRepo.getCurrencyById(data.currencyId);
	if (!currency) {
		throw new Error('Currency not found');
	}

	const accountId = crypto.randomUUID();
	const initialBalance = data.currentBalance ?? data.initialBalance;

	// Create the domain event
	const payload: AccountCreatedPayload = {
		name: data.name,
		description: data.description,
		type: data.type,
		initialBalance,
		currencyId: data.currencyId,
		color: data.color
	};

	const event = createAccountCreatedEvent(accountId, data.userId, payload, 1);

	// Append to event store
	await eventStoreRepo.append(event);

	// Update read model (projection) for fast queries
	await eventStoreRepo.createAccountProjection({
		id: accountId,
		userId: data.userId,
		name: data.name,
		description: data.description,
		type: data.type,
		initialBalance,
		currentBalance: initialBalance,
		currencyId: data.currencyId,
		color: data.color,
		createdAt: event.occurredAt,
		updatedAt: event.occurredAt
	});

	// Return the created account
	return {
		id: accountId,
		userId: data.userId,
		name: data.name,
		description: data.description,
		type: data.type,
		initialBalance,
		currentBalance: initialBalance,
		currencyId: data.currencyId,
		color: data.color,
		createdAt: event.occurredAt,
		updatedAt: event.occurredAt
	};
}
