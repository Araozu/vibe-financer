import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { createBudgetCreatedEvent, type BudgetCreatedPayload } from '$lib/domain/events';

export interface CreateBudgetDTO {
	userId: string;
	category: string;
	limit: number;
	currencyId: string;
	period: 'monthly' | 'weekly' | 'yearly';
	startDate: Date;
}

export async function createBudget(data: CreateBudgetDTO) {
	const budgetId = crypto.randomUUID();

	const currency = await eventStoreRepo.getCurrencyById(data.currencyId);
	if (!currency) {
		throw new Error('Currency not found');
	}

	const payload: BudgetCreatedPayload = {
		budgetId,
		category: data.category,
		limit: data.limit,
		currencyId: data.currencyId,
		period: data.period,
		startDate: data.startDate
	};

	const event = createBudgetCreatedEvent(budgetId, data.userId, payload, 1);

	// Append to event store
	await eventStoreRepo.append(event);

	// Update read model (projection)
	await eventStoreRepo.createBudgetProjection({
		id: budgetId,
		userId: data.userId,
		category: data.category,
		limit: data.limit,
		currencyId: data.currencyId,
		period: data.period,
		startDate: data.startDate,
		currentSpent: 0
	});

	return {
		id: budgetId,
		...data,
		currentSpent: 0,
		createdAt: event.occurredAt,
		updatedAt: event.occurredAt
	};
}
