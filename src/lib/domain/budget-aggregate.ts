/**
 * Budget Aggregate
 *
 * This module contains the aggregate logic for budgets.
 * State is rebuilt from the event stream.
 */

import type {
	BudgetCreatedEvent,
	BudgetUpdatedEvent,
	BudgetDeletedEvent,
	DomainEvent
} from './events';

export interface BudgetState {
	id: string;
	userId: string;
	category: string;
	limit: number;
	currencyId: string;
	period: 'monthly' | 'weekly' | 'yearly';
	startDate: Date;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	version: number;
}

/** Event payloads / DB JSON often deserialize dates as strings. */
function asDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

/**
 * Project budget state from events
 */
export function projectBudgetState(events: DomainEvent[]): BudgetState | null {
	if (events.length === 0) return null;

	let state: BudgetState | null = null;

	for (const event of events) {
		state = applyEvent(state, event);
		if (state?.isDeleted) break;
	}

	return state;
}

/**
 * Apply a single event to the state
 */
function applyEvent(state: BudgetState | null, event: DomainEvent): BudgetState | null {
	switch (event.eventType) {
		case 'BudgetCreated': {
			const e = event as BudgetCreatedEvent;
			return {
				id: e.streamId,
				userId: e.userId,
				category: e.payload.category,
				limit: e.payload.limit,
				currencyId: e.payload.currencyId,
				period: e.payload.period,
				startDate: asDate(e.payload.startDate),
				createdAt: asDate(e.occurredAt),
				updatedAt: asDate(e.occurredAt),
				isDeleted: false,
				version: e.version
			};
		}

		case 'BudgetUpdated': {
			if (!state) return null;
			const e = event as BudgetUpdatedEvent;
			const changes = e.payload.changes;

			return {
				...state,
				category: changes.category ?? state.category,
				limit: changes.limit ?? state.limit,
				period: changes.period ?? state.period,
				startDate: changes.startDate !== undefined ? asDate(changes.startDate) : state.startDate,
				updatedAt: asDate(e.occurredAt),
				version: e.version
			};
		}

		case 'BudgetDeleted': {
			if (!state) return null;
			const e = event as BudgetDeletedEvent;
			return {
				...state,
				isDeleted: true,
				updatedAt: asDate(e.occurredAt),
				version: e.version
			};
		}

		default:
			return state;
	}
}
