import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { createBudgetCreatedEvent, type BudgetCreatedPayload } from '$lib/domain/events';
import { normalizeBudgetColor, normalizeBudgetIcon } from '$lib/domain/budget-visuals';

export interface CreateBudgetDTO {
	userId: string;
	category: string;
	limit: number;
	currencyId: string;
	icon?: string;
	color?: string;
	period: 'monthly' | 'weekly' | 'yearly';
	startDate: Date;
}

export async function createBudget(data: CreateBudgetDTO) {
	const budgetId = crypto.randomUUID();

	const currency = await eventStoreRepo.getCurrencyById(data.currencyId);
	if (!currency) {
		throw new Error('Currency not found');
	}

	const icon = normalizeBudgetIcon(data.icon);
	const color = normalizeBudgetColor(data.color);

	const payload: BudgetCreatedPayload = {
		budgetId,
		category: data.category,
		limit: data.limit,
		currencyId: data.currencyId,
		icon,
		color,
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
		icon,
		color,
		period: data.period,
		startDate: data.startDate,
		currentSpent: 0
	});

	return {
		id: budgetId,
		...data,
		icon,
		color,
		currentSpent: 0,
		createdAt: event.occurredAt,
		updatedAt: event.occurredAt
	};
}
