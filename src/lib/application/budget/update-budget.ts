import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { transactionRepo } from '$lib/infra/repos/transaction.repo';
import { projectBudgetState } from '$lib/domain/budget-aggregate';
import { createBudgetUpdatedEvent, type BudgetUpdatedPayload } from '$lib/domain/events';

export interface UpdateBudgetDTO {
	category?: string;
	limit?: number;
	period?: 'monthly' | 'weekly' | 'yearly';
	startDate?: Date;
}

export async function updateBudget(budgetId: string, userId: string, data: UpdateBudgetDTO) {
	const events = await eventStoreRepo.getStream(budgetId);
	const currentState = projectBudgetState(events);

	if (!currentState) {
		throw new Error('Budget not found');
	}
	if (currentState.isDeleted) {
		throw new Error('Budget has been deleted');
	}
	if (currentState.userId !== userId) {
		throw new Error('Unauthorized');
	}

	const changes: BudgetUpdatedPayload['changes'] = {};
	const previousValues: BudgetUpdatedPayload['previousValues'] = {};

	if (data.category !== undefined) {
		const trimmed = data.category.trim();
		if (!trimmed) {
			throw new Error('Category cannot be empty');
		}
		if (trimmed !== currentState.category) {
			changes.category = trimmed;
			previousValues.category = currentState.category;
		}
	}

	if (data.limit !== undefined) {
		if (!Number.isFinite(data.limit) || data.limit < 0) {
			throw new Error('Limit must be a non-negative number');
		}
		if (data.limit !== currentState.limit) {
			changes.limit = data.limit;
			previousValues.limit = currentState.limit;
		}
	}

	if (data.period !== undefined && data.period !== currentState.period) {
		changes.period = data.period;
		previousValues.period = currentState.period;
	}

	if (data.startDate !== undefined) {
		const next = data.startDate;
		if (Number.isNaN(next.getTime())) {
			throw new Error('Invalid start date');
		}
		if (next.getTime() !== currentState.startDate.getTime()) {
			changes.startDate = next;
			previousValues.startDate = currentState.startDate;
		}
	}

	if (Object.keys(changes).length === 0) {
		return {
			id: currentState.id,
			userId: currentState.userId,
			category: currentState.category,
			limit: currentState.limit,
			currencyId: currentState.currencyId,
			period: currentState.period,
			startDate: currentState.startDate
		};
	}

	const currentVersion = await eventStoreRepo.getStreamVersion(budgetId);
	const newVersion = currentVersion + 1;
	const payload: BudgetUpdatedPayload = { changes, previousValues };
	const event = createBudgetUpdatedEvent(budgetId, userId, payload, newVersion);

	try {
		await eventStoreRepo.append(event, { expectedVersion: currentVersion });
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw new Error('Concurrent update detected while updating budget. Please retry.');
		}
		throw err;
	}

	const projectionPatch: {
		category?: string;
		limit?: number;
		period?: 'monthly' | 'weekly' | 'yearly';
		startDate?: Date;
	} = {};
	if (changes.category !== undefined) projectionPatch.category = changes.category;
	if (changes.limit !== undefined) projectionPatch.limit = changes.limit;
	if (changes.period !== undefined) projectionPatch.period = changes.period;
	if (changes.startDate !== undefined) projectionPatch.startDate = changes.startDate;

	await eventStoreRepo.updateBudgetProjection(budgetId, projectionPatch);

	const effectiveCategory = changes.category ?? currentState.category;
	const effectiveStart = changes.startDate ?? currentState.startDate;

	if (changes.category !== undefined || changes.startDate !== undefined) {
		const spent = await transactionRepo.sumExpenseAmountsForUserCategoryCurrencySince(
			currentState.userId,
			currentState.currencyId,
			effectiveCategory,
			effectiveStart
		);
		await eventStoreRepo.updateBudgetProjection(budgetId, { currentSpent: spent });
	}

	return {
		id: currentState.id,
		userId: currentState.userId,
		category: effectiveCategory,
		limit: changes.limit ?? currentState.limit,
		currencyId: currentState.currencyId,
		period: changes.period ?? currentState.period,
		startDate: effectiveStart
	};
}
