/**
 * Account Aggregate
 *
 * This module contains the aggregate logic for accounts.
 * An aggregate is rebuilt from its event stream - it has no direct database state.
 */

import type { Account, Goal } from './account';
import type {
	AccountCreatedEvent,
	AccountDeletedEvent,
	AccountUpdatedEvent,
	DomainEvent,
	TransactionCreatedEvent,
	TransactionUpdatedEvent,
	TransactionDeletedEvent,
	TransferCreatedEvent,
	GoalSetEvent,
	GoalUpdatedEvent,
	GoalRemovedEvent
} from './events';

/**
 * Account state at a point in time, including balance history
 */
export interface AccountState extends Account {
	isDeleted: boolean;
	version: number;
	goal?: Goal | null;
}

export interface GoalState extends Goal {
	isRemoved: boolean;
	version: number;
}

export interface BalanceSnapshot {
	balance: number;
	timestamp: Date;
	eventId: string;
	eventType: string;
	transactionId?: string;
}

/**
 * Project account state from events
 * This is a left fold over the event stream
 */
export function projectAccountState(events: DomainEvent[]): AccountState | null {
	if (events.length === 0) return null;

	let state: AccountState | null = null;

	for (const event of events) {
		state = applyEvent(state, event);
		if (state?.isDeleted) break;
	}

	return state;
}

/**
 * Project account state from a snapshot + subsequent events
 * This is the optimized version that avoids replaying all events
 */
export function projectAccountStateFromSnapshot(
	snapshot: AccountState,
	events: DomainEvent[]
): AccountState {
	let state: AccountState = snapshot;

	for (const event of events) {
		const newState = applyEvent(state, event);
		if (newState) {
			state = newState;
		}
		if (state.isDeleted) break;
	}

	return state;
}

/**
 * Get balance history from events
 * Returns all balance changes with timestamps for time-travel queries
 */
export function projectBalanceHistory(events: DomainEvent[]): BalanceSnapshot[] {
	const history: BalanceSnapshot[] = [];
	let currentBalance = 0;
	let initialized = false;

	for (const event of events) {
		switch (event.eventType) {
			case 'AccountCreated': {
				const e = event as AccountCreatedEvent;
				currentBalance = e.payload.initialBalance;
				initialized = true;
				history.push({
					balance: currentBalance,
					timestamp: e.occurredAt,
					eventId: e.id,
					eventType: 'AccountCreated'
				});
				break;
			}
			case 'AccountUpdated': {
				const e = event as AccountUpdatedEvent;
				// If initial balance changed, adjust current balance
				if (e.payload.changes.initialBalance !== undefined) {
					const oldInitial = e.payload.previousValues.initialBalance ?? 0;
					const newInitial = e.payload.changes.initialBalance;
					const diff = newInitial - oldInitial;
					currentBalance += diff;
					history.push({
						balance: currentBalance,
						timestamp: e.occurredAt,
						eventId: e.id,
						eventType: 'AccountUpdated'
					});
				}
				break;
			}
			case 'TransactionCreated': {
				const e = event as TransactionCreatedEvent;
				currentBalance = e.payload.balanceAfter;
				history.push({
					balance: currentBalance,
					timestamp: e.payload.transactionDate,
					eventId: e.id,
					eventType: 'TransactionCreated',
					transactionId: e.payload.transactionId
				});
				break;
			}
			case 'TransferCreated': {
				const e = event as TransferCreatedEvent;
				// This event affects both accounts, but in the stream for fromAccount
				currentBalance = e.payload.fromBalanceAfter;
				history.push({
					balance: currentBalance,
					timestamp: e.payload.transactionDate,
					eventId: e.id,
					eventType: 'TransferCreated',
					transactionId: e.payload.transactionId
				});
				break;
			}
			case 'TransactionUpdated': {
				const e = event as TransactionUpdatedEvent;
				currentBalance = e.payload.balanceAfter;
				history.push({
					balance: currentBalance,
					timestamp: e.payload.transactionDate ?? e.occurredAt,
					eventId: e.id,
					eventType: 'TransactionUpdated',
					transactionId: e.payload.transactionId
				});
				break;
			}
			case 'TransactionDeleted': {
				const e = event as TransactionDeletedEvent;
				currentBalance += e.payload.balanceAdjustment;
				history.push({
					balance: currentBalance,
					timestamp: e.occurredAt,
					eventId: e.id,
					eventType: 'TransactionDeleted',
					transactionId: e.payload.transactionId
				});
				break;
			}
		}
	}

	return initialized ? history : [];
}

/**
 * Get balance at a specific point in time
 */
export function getBalanceAtTime(events: DomainEvent[], asOf: Date): number | null {
	const history = projectBalanceHistory(events);
	if (history.length === 0) return null;

	// Find the last snapshot before or at the given time
	let balance: number | null = null;
	for (const snapshot of history) {
		if (snapshot.timestamp <= asOf) {
			balance = snapshot.balance;
		} else {
			break;
		}
	}

	return balance;
}

/**
 * Project goal state from events
 */
export function projectGoalState(events: DomainEvent[]): GoalState | null {
	if (events.length === 0) return null;

	let state: GoalState | null = null;

	for (const event of events) {
		state = applyGoalEvent(state, event);
		if (state?.isRemoved) break;
	}

	return state;
}

/**
 * Apply a single goal event to the state
 */
function applyGoalEvent(state: GoalState | null, event: DomainEvent): GoalState | null {
	switch (event.eventType) {
		case 'GoalSet': {
			const e = event as GoalSetEvent;
			return {
				id: e.streamId,
				accountId: e.payload.accountId,
				name: e.payload.name,
				targetAmount: e.payload.targetAmount,
				targetDate: e.payload.targetDate,
				createdAt: e.occurredAt,
				updatedAt: e.occurredAt,
				isRemoved: false,
				version: e.version
			};
		}

		case 'GoalUpdated': {
			if (!state) return null;
			const e = event as GoalUpdatedEvent;
			const changes = e.payload.changes;

			return {
				...state,
				name: changes.name ?? state.name,
				targetAmount: changes.targetAmount ?? state.targetAmount,
				targetDate: changes.targetDate !== undefined ? changes.targetDate : state.targetDate,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		case 'GoalRemoved': {
			if (!state) return null;
			const e = event as GoalRemovedEvent;
			return {
				...state,
				isRemoved: true,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		default:
			return state;
	}
}

/**
 * Apply a single event to the state
 * This is the core state machine
 */
function applyEvent(state: AccountState | null, event: DomainEvent): AccountState | null {
	switch (event.eventType) {
		case 'AccountCreated': {
			const e = event as AccountCreatedEvent;
			return {
				id: e.streamId,
				userId: e.userId,
				name: e.payload.name,
				description: e.payload.description,
				type: e.payload.type,
				initialBalance: e.payload.initialBalance,
				currentBalance: e.payload.initialBalance,
				currencyId: e.payload.currencyId,
				color: e.payload.color,
				createdAt: e.occurredAt,
				updatedAt: e.occurredAt,
				isDeleted: false,
				version: e.version
			};
		}

		case 'AccountUpdated': {
			if (!state) return null;
			const e = event as AccountUpdatedEvent;
			const changes = e.payload.changes;

			let newBalance = state.currentBalance;
			if (changes.initialBalance !== undefined) {
				const oldInitial = e.payload.previousValues.initialBalance ?? state.initialBalance;
				const diff = changes.initialBalance - oldInitial;
				newBalance = state.currentBalance + diff;
			}

			return {
				...state,
				name: changes.name ?? state.name,
				description: changes.description !== undefined ? changes.description : state.description,
				type: changes.type ?? state.type,
				initialBalance: changes.initialBalance ?? state.initialBalance,
				currentBalance: newBalance,
				currencyId: changes.currencyId ?? state.currencyId,
				color: changes.color ?? state.color,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		case 'AccountDeleted': {
			if (!state) return null;
			const e = event as AccountDeletedEvent;
			return {
				...state,
				isDeleted: true,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		case 'TransactionCreated': {
			if (!state) return null;
			const e = event as TransactionCreatedEvent;
			return {
				...state,
				currentBalance: e.payload.balanceAfter,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		case 'TransferCreated': {
			if (!state) return null;
			const e = event as TransferCreatedEvent;
			// Update balance for the source account
			return {
				...state,
				currentBalance: e.payload.fromBalanceAfter,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		case 'TransactionUpdated': {
			if (!state) return null;
			const e = event as TransactionUpdatedEvent;
			return {
				...state,
				currentBalance: e.payload.balanceAfter,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		case 'TransactionDeleted': {
			if (!state) return null;
			const e = event as TransactionDeletedEvent;
			return {
				...state,
				currentBalance: state.currentBalance + e.payload.balanceAdjustment,
				updatedAt: e.occurredAt,
				version: e.version
			};
		}

		default:
			return state;
	}
}

/**
 * Validate that an account can accept a transaction
 */
export function canAcceptTransaction(state: AccountState | null): boolean {
	return state !== null && !state.isDeleted;
}

/**
 * Calculate balance change for a transaction type
 */
export function calculateBalanceChange(
	currentBalance: number,
	amount: number,
	type: 'expense' | 'income' | 'transfer'
): number {
	switch (type) {
		case 'income':
			return currentBalance + amount;
		case 'expense':
		case 'transfer':
			return currentBalance - amount;
	}
}
