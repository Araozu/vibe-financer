import { db } from '$lib/infra/db';
import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { getAccountState, getAccountVersion } from '../account/account-projection';
import {
	calculateBalanceChange,
	canAcceptTransaction
} from '$lib/domain/account-aggregate';
import {
	validateTransferAccounts,
	type CreateTransactionDTO,
	type Transaction
} from '$lib/domain/transaction';
import {
	createTransactionCreatedEvent,
	createTransferCreatedEvent,
	type TransactionCreatedPayload,
	type TransferCreatedPayload
} from '$lib/domain/events';
import { error } from '@sveltejs/kit';

export async function createTransaction(
	data: CreateTransactionDTO,
	userId: string
): Promise<Transaction> {
	// 1. Get the source account state from event stream
	const sourceAccount = await getAccountState(data.accountId);

	if (!sourceAccount || !canAcceptTransaction(sourceAccount)) {
		throw error(404, 'Account not found or deleted');
	}

	const transactionId = crypto.randomUUID();
	const transactionDate = data.createdAt ?? new Date();
	const sourceVersion = await getAccountVersion(data.accountId);

	// 2. Handle transfers specially (two accounts involved)
	if (data.type === 'transfer') {
		if (!data.toAccountId) {
			throw error(400, 'Transfer requires a destination account');
		}

		const destAccount = await getAccountState(data.toAccountId);

		if (!destAccount || !canAcceptTransaction(destAccount)) {
			throw error(404, 'Destination account not found or deleted');
		}

		if (!validateTransferAccounts(sourceAccount.currencyCode, destAccount.currencyCode)) {
			throw error(400, 'Cannot transfer between accounts with different currencies');
		}

		const destVersion = await getAccountVersion(data.toAccountId);

		// Calculate new balances
		const fromBalanceAfter = sourceAccount.currentBalance - data.amount;
		const toBalanceAfter = destAccount.currentBalance + data.amount;

		// Create transfer event (stored in source account's stream)
		const transferPayload: TransferCreatedPayload = {
			transactionId,
			fromAccountId: data.accountId,
			toAccountId: data.toAccountId,
			amount: data.amount,
			name: data.name ?? null,
			description: data.description ?? null,
			category: data.category ?? null,
			fromBalanceBefore: sourceAccount.currentBalance,
			fromBalanceAfter,
			toBalanceBefore: destAccount.currentBalance,
			toBalanceAfter,
			transactionDate
		};

		const sourceEvent = createTransferCreatedEvent(
			data.accountId,
			userId,
			transferPayload,
			sourceVersion + 1
		);

		// Create a corresponding event for the destination account
		const destTransactionPayload: TransactionCreatedPayload = {
			transactionId,
			accountId: data.toAccountId,
			type: 'income', // Transfer in is income for dest
			amount: data.amount,
			name: data.name ?? null,
			description: `Transfer from ${sourceAccount.name}`,
			category: data.category ?? null,
			payee: null,
			toAccountId: null,
			balanceBefore: destAccount.currentBalance,
			balanceAfter: toBalanceAfter,
			transactionDate
		};

		const destEvent = createTransactionCreatedEvent(
			data.toAccountId,
			userId,
			destTransactionPayload,
			destVersion + 1
		);

		// Append both events (using individual calls for different streams)
		await eventStoreRepo.append(sourceEvent, { expectedVersion: sourceVersion });
		await eventStoreRepo.append(destEvent, { expectedVersion: destVersion });

		// Update read models
		await eventStoreRepo.updateAccountProjection(data.accountId, {
			currentBalance: fromBalanceAfter
		});
		await eventStoreRepo.updateAccountProjection(data.toAccountId, {
			currentBalance: toBalanceAfter
		});

		// Create transaction read model
		await eventStoreRepo.createTransactionProjection({
			id: transactionId,
			accountId: data.accountId,
			type: 'transfer',
			amount: data.amount,
			name: data.name ?? null,
			description: data.description ?? null,
			category: data.category ?? null,
			payee: data.payee ?? null,
			toAccountId: data.toAccountId,
			createdAt: transactionDate
		});

		return {
			id: transactionId,
			accountId: data.accountId,
			type: 'transfer',
			amount: data.amount,
			name: data.name ?? null,
			description: data.description ?? null,
			category: data.category ?? null,
			payee: data.payee ?? null,
			toAccountId: data.toAccountId,
			createdAt: transactionDate,
			updatedAt: transactionDate
		};
	}

	// 3. Handle regular transactions (expense/income)
	const balanceBefore = sourceAccount.currentBalance;
	const balanceAfter = calculateBalanceChange(balanceBefore, data.amount, data.type);

	const payload: TransactionCreatedPayload = {
		transactionId,
		accountId: data.accountId,
		type: data.type,
		amount: data.amount,
		name: data.name ?? null,
		description: data.description ?? null,
		category: data.category ?? null,
		payee: data.payee ?? null,
		toAccountId: null,
		balanceBefore,
		balanceAfter,
		transactionDate
	};

	const event = createTransactionCreatedEvent(
		data.accountId,
		userId,
		payload,
		sourceVersion + 1
	);

	// Append event with optimistic concurrency
	await eventStoreRepo.append(event, { expectedVersion: sourceVersion });

	// Update account read model
	await eventStoreRepo.updateAccountProjection(data.accountId, {
		currentBalance: balanceAfter
	});

	// Create transaction read model
	await eventStoreRepo.createTransactionProjection({
		id: transactionId,
		accountId: data.accountId,
		type: data.type,
		amount: data.amount,
		name: data.name ?? null,
		description: data.description ?? null,
		category: data.category ?? null,
		payee: data.payee ?? null,
		toAccountId: null,
		createdAt: transactionDate
	});

	return {
		id: transactionId,
		accountId: data.accountId,
		type: data.type,
		amount: data.amount,
		name: data.name ?? null,
		description: data.description ?? null,
		category: data.category ?? null,
		payee: data.payee ?? null,
		toAccountId: null,
		createdAt: transactionDate,
		updatedAt: transactionDate
	};
}

