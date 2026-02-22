/**
 * Currency Aggregate
 *
 * This module contains the aggregate logic for currencies.
 */

import type { Currency } from './currency';
import type {
	CurrencyCreatedEvent,
	CurrencyUpdatedEvent,
	CurrencyDeletedEvent,
	DomainEvent
} from './events';

export interface CurrencyState extends Currency {
	isDeleted: boolean;
	version: number;
	createdAt: Date;
	updatedAt: Date;
}

export function projectCurrencyState(events: DomainEvent[]): CurrencyState | null {
	if (events.length === 0) return null;

	let state: CurrencyState | null = null;

	for (const event of events) {
		state = applyEvent(state, event);
		if (state?.isDeleted) break;
	}

	return state;
}

function applyEvent(state: CurrencyState | null, event: DomainEvent): CurrencyState | null {
	switch (event.eventType) {
		case 'CurrencyCreated': {
			const e = event as CurrencyCreatedEvent;
			return {
				id: e.streamId,
				code: e.payload.code,
				symbol: e.payload.symbol,
				name: e.payload.name,
				isDeleted: false,
				version: e.version,
				createdAt: e.occurredAt,
				updatedAt: e.occurredAt
			};
		}

		case 'CurrencyUpdated': {
			if (!state) return null;
			const e = event as CurrencyUpdatedEvent;
			const changes = e.payload.changes;

			return {
				...state,
				code: changes.code ?? state.code,
				symbol: changes.symbol ?? state.symbol,
				name: changes.name ?? state.name,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		case 'CurrencyDeleted': {
			if (!state) return null;
			const e = event as CurrencyDeletedEvent;
			return {
				...state,
				isDeleted: true,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		default:
			return state;
	}
}
