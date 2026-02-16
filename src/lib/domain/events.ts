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
	| 'TransferCreated';

export type StreamType = 'account' | 'transaction';

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
	type: 'asset' | 'expense' | 'revenue' | 'liability';
	initialBalance: number;
	currencyCode: string;
	currencySymbol: string;
	color: string;
}

export interface AccountUpdatedPayload {
	changes: {
		name?: string;
		description?: string | null;
		type?: 'asset' | 'expense' | 'revenue' | 'liability';
		initialBalance?: number;
		currencyCode?: string;
		currencySymbol?: string;
		color?: string;
	};
	previousValues: {
		name?: string;
		description?: string | null;
		type?: 'asset' | 'expense' | 'revenue' | 'liability';
		initialBalance?: number;
		currencyCode?: string;
		currencySymbol?: string;
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
}

export interface TransferCreatedPayload {
	transactionId: string;
	fromAccountId: string;
	toAccountId: string;
	amount: number;
	name: string | null;
	description: string | null;
	category: string | null;
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
export type DomainEvent = AccountEvent | TransactionEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Event Factory Functions (Pure)
// ─────────────────────────────────────────────────────────────────────────────

export function createEventId(): string {
	return crypto.randomUUID();
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
