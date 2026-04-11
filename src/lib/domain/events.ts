import { toUTC } from './date-formatter';

/**
 * Event Sourcing Domain Types
 *
 * This module defines all domain events that represent state changes in the system.
 * Events are immutable facts that have happened - they are never deleted or modified.
 */

export type EventType =
	| 'AccountCreated'
	| 'AccountUpdated'
	| 'AccountDeleted'
	| 'TransactionCreated'
	| 'TransactionUpdated'
	| 'TransactionDeleted'
	| 'TransferCreated'
	| 'BudgetCreated'
	| 'BudgetUpdated'
	| 'BudgetDeleted'
	| 'CurrencyCreated'
	| 'CurrencyUpdated'
	| 'CurrencyDeleted'
	| 'GoalSet'
	| 'GoalUpdated'
	| 'GoalRemoved';

export type StreamType = 'account' | 'transaction' | 'budget' | 'currency' | 'goal';

/**
 * Base event structure - all events extend this
 */
export interface BaseEvent<T extends EventType = EventType, P = unknown> {
	id: string;
	streamId: string; // The aggregate ID (e.g., account ID)
	streamType: StreamType;
	eventType: T;
	payload: P;
	version: number; // Version within the stream for optimistic concurrency
	occurredAt: Date;
	userId: string; // Who performed the action (audit trail)
	metadata?: Record<string, unknown>; // Additional context (IP, user agent, etc.)
}

// ─────────────────────────────────────────────────────────────────────────────
// Account Events
// ─────────────────────────────────────────────────────────────────────────────

export interface AccountCreatedPayload {
	name: string;
	description: string | null;
	type: 'asset' | 'expense' | 'revenue' | 'liability' | 'savings';
	initialBalance: number;
	currencyId: string;
	color: string;
}

export interface AccountUpdatedPayload {
	changes: {
		name?: string;
		description?: string | null;
		type?: 'asset' | 'expense' | 'revenue' | 'liability' | 'savings';
		initialBalance?: number;
		currencyId?: string;
		color?: string;
	};
	previousValues: {
		name?: string;
		description?: string | null;
		type?: 'asset' | 'expense' | 'revenue' | 'liability' | 'savings';
		initialBalance?: number;
		currencyId?: string;
		color?: string;
	};
}

export interface AccountDeletedPayload {
	reason?: string;
}

export type AccountCreatedEvent = BaseEvent<'AccountCreated', AccountCreatedPayload>;
export type AccountUpdatedEvent = BaseEvent<'AccountUpdated', AccountUpdatedPayload>;
export type AccountDeletedEvent = BaseEvent<'AccountDeleted', AccountDeletedPayload>;

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Events
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionCreatedPayload {
	transactionId: string; // The transaction's own ID
	accountId: string;
	type: 'expense' | 'income' | 'transfer';
	amount: number;
	name: string | null;
	description: string | null;
	category: string | null;
	payee: string | null;
	toAccountId: string | null;
	balanceBefore: number;
	balanceAfter: number;
	transactionDate: Date; // When the transaction actually occurred
}

export interface TransactionDeletedPayload {
	transactionId: string;
	reason?: string;
	balanceAdjustment: number; // How much to adjust the balance back
}

export interface TransactionUpdatedPayload {
	transactionId: string;
	changes: {
		accountId?: string; // When the transaction moves to a different account
		type?: 'expense' | 'income' | 'transfer';
		amount?: number;
		name?: string | null;
		description?: string | null;
		category?: string | null;
		payee?: string | null;
		toAccountId?: string | null;
		transactionDate?: Date;
	};
	previousValues: {
		accountId?: string;
		type?: 'expense' | 'income' | 'transfer';
		amount?: number;
		name?: string | null;
		description?: string | null;
		category?: string | null;
		payee?: string | null;
		toAccountId?: string | null;
		transactionDate?: Date;
	};
	balanceAdjustment: number; // Net change in balance due to edit
	balanceBefore: number;
	balanceAfter: number;
	transactionDate?: Date; // Optional: if the date was changed
}

export interface TransferCreatedPayload {
	transactionId: string;
	fromAccountId: string;
	toAccountId: string;
	amount: number;
	/** The amount credited to the destination account (may differ from `amount` when exchangeRate is set) */
	destinationAmount: number;
	name: string | null;
	description: string | null;
	category: string | null;
	/** Exchange rate applied: 1 unit of source currency = exchangeRate units of destination currency. Null when same currency. */
	exchangeRate: number | null;
	fromBalanceBefore: number;
	fromBalanceAfter: number;
	toBalanceBefore: number;
	toBalanceAfter: number;
	transactionDate: Date;
}

export type TransactionCreatedEvent = BaseEvent<'TransactionCreated', TransactionCreatedPayload>;
export type TransactionUpdatedEvent = BaseEvent<'TransactionUpdated', TransactionUpdatedPayload>;
export type TransactionDeletedEvent = BaseEvent<'TransactionDeleted', TransactionDeletedPayload>;
export type TransferCreatedEvent = BaseEvent<'TransferCreated', TransferCreatedPayload>;

// ─────────────────────────────────────────────────────────────────────────────
// Union Types
// ─────────────────────────────────────────────────────────────────────────────

export type AccountEvent = AccountCreatedEvent | AccountUpdatedEvent | AccountDeletedEvent;
export type TransactionEvent =
	| TransactionCreatedEvent
	| TransactionUpdatedEvent
	| TransactionDeletedEvent
	| TransferCreatedEvent;

export interface GoalSetPayload {
	goalId: string;
	accountId: string;
	targetAmount: number;
	targetDate: Date | null;
	name: string;
}

export interface GoalUpdatedPayload {
	changes: {
		targetAmount?: number;
		targetDate?: Date | null;
		name?: string;
	};
	previousValues: {
		targetAmount?: number;
		targetDate?: Date | null;
		name?: string;
	};
}

export interface GoalRemovedPayload {
	reason?: string;
}

export type GoalSetEvent = BaseEvent<'GoalSet', GoalSetPayload>;
export type GoalUpdatedEvent = BaseEvent<'GoalUpdated', GoalUpdatedPayload>;
export type GoalRemovedEvent = BaseEvent<'GoalRemoved', GoalRemovedPayload>;

export type GoalEvent = GoalSetEvent | GoalUpdatedEvent | GoalRemovedEvent;

export type DomainEvent = AccountEvent | TransactionEvent | BudgetEvent | CurrencyEvent | GoalEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Budget Events
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetCreatedPayload {
	budgetId: string;
	category: string;
	limit: number;
	currencyId: string;
	period: 'monthly' | 'weekly' | 'yearly';
	startDate: Date;
}

export interface BudgetUpdatedPayload {
	changes: {
		category?: string;
		limit?: number;
		period?: 'monthly' | 'weekly' | 'yearly';
		startDate?: Date;
	};
	previousValues: {
		category?: string;
		limit?: number;
		period?: 'monthly' | 'weekly' | 'yearly';
		startDate?: Date;
	};
}

export interface BudgetDeletedPayload {
	reason?: string;
}

export type BudgetCreatedEvent = BaseEvent<'BudgetCreated', BudgetCreatedPayload>;
export type BudgetUpdatedEvent = BaseEvent<'BudgetUpdated', BudgetUpdatedPayload>;
export type BudgetDeletedEvent = BaseEvent<'BudgetDeleted', BudgetDeletedPayload>;

export type BudgetEvent = BudgetCreatedEvent | BudgetUpdatedEvent | BudgetDeletedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Currency Events
// ─────────────────────────────────────────────────────────────────────────────

export interface CurrencyCreatedPayload {
	currencyId: string;
	code: string;
	symbol: string;
	name: string;
}

export interface CurrencyUpdatedPayload {
	changes: {
		code?: string;
		symbol?: string;
		name?: string;
	};
	previousValues: {
		code?: string;
		symbol?: string;
		name?: string;
	};
}

export interface CurrencyDeletedPayload {
	reason?: string;
}

export type CurrencyCreatedEvent = BaseEvent<'CurrencyCreated', CurrencyCreatedPayload>;
export type CurrencyUpdatedEvent = BaseEvent<'CurrencyUpdated', CurrencyUpdatedPayload>;
export type CurrencyDeletedEvent = BaseEvent<'CurrencyDeleted', CurrencyDeletedPayload>;

export type CurrencyEvent = CurrencyCreatedEvent | CurrencyUpdatedEvent | CurrencyDeletedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Event Factory Functions (Pure)
// ─────────────────────────────────────────────────────────────────────────────

export function createEventId(): string {
	return crypto.randomUUID();
}

export function createCurrencyCreatedEvent(
	currencyId: string,
	userId: string,
	payload: CurrencyCreatedPayload,
	version: number = 1
): CurrencyCreatedEvent {
	return {
		id: createEventId(),
		streamId: currencyId,
		streamType: 'currency',
		eventType: 'CurrencyCreated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createCurrencyUpdatedEvent(
	currencyId: string,
	userId: string,
	payload: CurrencyUpdatedPayload,
	version: number
): CurrencyUpdatedEvent {
	return {
		id: createEventId(),
		streamId: currencyId,
		streamType: 'currency',
		eventType: 'CurrencyUpdated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createCurrencyDeletedEvent(
	currencyId: string,
	userId: string,
	payload: CurrencyDeletedPayload,
	version: number
): CurrencyDeletedEvent {
	return {
		id: createEventId(),
		streamId: currencyId,
		streamType: 'currency',
		eventType: 'CurrencyDeleted',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createBudgetCreatedEvent(
	budgetId: string,
	userId: string,
	payload: BudgetCreatedPayload,
	version: number = 1
): BudgetCreatedEvent {
	return {
		id: createEventId(),
		streamId: budgetId,
		streamType: 'budget',
		eventType: 'BudgetCreated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createBudgetUpdatedEvent(
	budgetId: string,
	userId: string,
	payload: BudgetUpdatedPayload,
	version: number
): BudgetUpdatedEvent {
	return {
		id: createEventId(),
		streamId: budgetId,
		streamType: 'budget',
		eventType: 'BudgetUpdated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createBudgetDeletedEvent(
	budgetId: string,
	userId: string,
	payload: BudgetDeletedPayload,
	version: number
): BudgetDeletedEvent {
	return {
		id: createEventId(),
		streamId: budgetId,
		streamType: 'budget',
		eventType: 'BudgetDeleted',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createAccountCreatedEvent(
	accountId: string,
	userId: string,
	payload: AccountCreatedPayload,
	version: number = 1
): AccountCreatedEvent {
	return {
		id: createEventId(),
		streamId: accountId,
		streamType: 'account',
		eventType: 'AccountCreated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createAccountUpdatedEvent(
	accountId: string,
	userId: string,
	payload: AccountUpdatedPayload,
	version: number
): AccountUpdatedEvent {
	return {
		id: createEventId(),
		streamId: accountId,
		streamType: 'account',
		eventType: 'AccountUpdated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createAccountDeletedEvent(
	accountId: string,
	userId: string,
	payload: AccountDeletedPayload,
	version: number
): AccountDeletedEvent {
	return {
		id: createEventId(),
		streamId: accountId,
		streamType: 'account',
		eventType: 'AccountDeleted',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createTransactionCreatedEvent(
	accountId: string,
	userId: string,
	payload: TransactionCreatedPayload,
	version: number
): TransactionCreatedEvent {
	return {
		id: createEventId(),
		streamId: accountId,
		streamType: 'account', // Transactions are part of the account stream
		eventType: 'TransactionCreated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createTransferCreatedEvent(
	fromAccountId: string,
	userId: string,
	payload: TransferCreatedPayload,
	version: number
): TransferCreatedEvent {
	return {
		id: createEventId(),
		streamId: fromAccountId,
		streamType: 'account',
		eventType: 'TransferCreated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createTransactionUpdatedEvent(
	accountId: string,
	userId: string,
	payload: TransactionUpdatedPayload,
	version: number
): TransactionUpdatedEvent {
	return {
		id: createEventId(),
		streamId: accountId,
		streamType: 'account',
		eventType: 'TransactionUpdated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createTransactionDeletedEvent(
	accountId: string,
	userId: string,
	payload: TransactionDeletedPayload,
	version: number
): TransactionDeletedEvent {
	return {
		id: createEventId(),
		streamId: accountId,
		streamType: 'account',
		eventType: 'TransactionDeleted',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createGoalSetEvent(
	goalId: string,
	userId: string,
	payload: GoalSetPayload,
	version: number = 1
): GoalSetEvent {
	return {
		id: createEventId(),
		streamId: goalId,
		streamType: 'goal',
		eventType: 'GoalSet',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createGoalUpdatedEvent(
	goalId: string,
	userId: string,
	payload: GoalUpdatedPayload,
	version: number
): GoalUpdatedEvent {
	return {
		id: createEventId(),
		streamId: goalId,
		streamType: 'goal',
		eventType: 'GoalUpdated',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}

export function createGoalRemovedEvent(
	goalId: string,
	userId: string,
	payload: GoalRemovedPayload,
	version: number
): GoalRemovedEvent {
	return {
		id: createEventId(),
		streamId: goalId,
		streamType: 'goal',
		eventType: 'GoalRemoved',
		payload,
		version,
		occurredAt: toUTC(new Date()),
		userId
	};
}
