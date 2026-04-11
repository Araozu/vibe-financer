import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { getAccountState, getAccountVersion } from '../account/account-projection';
import { calculateBalanceChange, canAcceptTransaction } from '$lib/domain/account-aggregate';
import type { CreateTransactionDTO, Transaction } from '$lib/domain/transaction';
import { validateExchangeRate } from '$lib/domain/transaction';
import {
	createTransactionCreatedEvent,
	createTransferCreatedEvent,
	type TransactionCreatedPayload,
	type TransferCreatedPayload
} from '$lib/domain/events';
import { error } from '@sveltejs/kit';
import { toUTC } from '$lib/domain/date-formatter';

/**
 * Create a new transaction (expense, income, or transfer) and persist as a TransactionCreated event.
 *
 * @param data - The transaction details
 * @param userId - The ID of the user creating the transaction (required for event sourcing audit trails)
 * @returns The created transaction
 *
 * The userId parameter is required for event sourcing to maintain a complete audit trail
 * of who made each change. All events in the event store must be attributed to a user
 * for compliance and debugging purposes.
 */
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
	const transactionDate = toUTC(data.createdAt ?? new Date());
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

		if (sourceAccount.currencyId !== destAccount.currencyId) {
			if (!validateExchangeRate(data.exchangeRate)) {
				throw error(
					400,
					'Exchange rate is required for transfers between accounts with different currencies'
				);
			}
		}

		const exchangeRate =
			sourceAccount.currencyId !== destAccount.currencyId ? data.exchangeRate! : null;

		const destVersion = await getAccountVersion(data.toAccountId);

		// Calculate new balances
		const fromBalanceAfter = sourceAccount.currentBalance - data.amount;
		const destinationAmount = exchangeRate != null ? Math.round(data.amount * exchangeRate) : data.amount;
		const toBalanceAfter = destAccount.currentBalance + destinationAmount;

		// Create transfer event (stored in source account's stream)
		const transferPayload: TransferCreatedPayload = {
			transactionId,
			fromAccountId: data.accountId,
			toAccountId: data.toAccountId,
			amount: data.amount,
			destinationAmount,
			name: data.name ?? null,
			description: data.description ?? null,
			category: data.category ?? null,
			exchangeRate,
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
			amount: destinationAmount,
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

		// Append both events and update projections atomically in a single transaction
		try {
			await eventStoreRepo.runInTransaction(async (tx) => {
				await eventStoreRepo.append(sourceEvent, { expectedVersion: sourceVersion }, tx);
				await eventStoreRepo.append(destEvent, { expectedVersion: destVersion }, tx);

				// Update read models within the same transaction
				await eventStoreRepo.updateAccountProjection(
					data.accountId,
					{ currentBalance: fromBalanceAfter },
					tx
				);
				await eventStoreRepo.updateAccountProjection(
					data.toAccountId!,
					{ currentBalance: toBalanceAfter },
					tx
				);

				// Create transaction read model
				await eventStoreRepo.createTransactionProjection(
					{
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
					},
					tx
				);
			});
		} catch (err: unknown) {
			const e = err as { name?: string };
			if (e?.name === 'ConcurrencyError') {
				throw error(409, 'Concurrent update detected while creating transfer. Please retry.');
			}
			throw err;
		}

		// Update active budgets for this category (transfers are often treated as expenses for the source account)
		if (data.category) {
			const activeBudgets = await eventStoreRepo.getActiveBudgetsByCategory(
				data.category,
				transactionDate
			);
			for (const b of activeBudgets) {
				await eventStoreRepo.updateBudgetProjection(b.id, {
					currentSpent: b.currentSpent + data.amount
				});
			}
		}

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
			updatedAt: transactionDate,
			deletedAt: null
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

	const event = createTransactionCreatedEvent(data.accountId, userId, payload, sourceVersion + 1);

	// Append event and update projections atomically with optimistic concurrency
	try {
		await eventStoreRepo.runInTransaction(async (tx) => {
			await eventStoreRepo.append(event, { expectedVersion: sourceVersion }, tx);
			await eventStoreRepo.updateAccountProjection(
				data.accountId,
				{
					currentBalance: balanceAfter
				},
				tx
			);
			await eventStoreRepo.createTransactionProjection(
				{
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
				},
				tx
			);
		});
	} catch (err: unknown) {
		// Handle concurrent transaction creation gracefully
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			// Another transaction modified this account concurrently; surface a conflict instead of 500
			throw error(409, 'Concurrent update detected while creating transaction. Please retry.');
		}

		throw err;
	}

	// Update active budgets for this category
	if (data.category && data.type === 'expense') {
		const activeBudgets = await eventStoreRepo.getActiveBudgetsByCategory(
			data.category,
			transactionDate
		);
		for (const b of activeBudgets) {
			await eventStoreRepo.updateBudgetProjection(b.id, {
				currentSpent: b.currentSpent + data.amount
			});
		}
	}

	return {
		id: transactionId,
		accountId: data.accountId,
		type: data.type,
		amount: data.amount,
		name: data.name ?? null,
		deletedAt: null,
		description: data.description ?? null,
		category: data.category ?? null,
		payee: data.payee ?? null,
		toAccountId: null,
		createdAt: transactionDate,
		updatedAt: transactionDate
	};
}
