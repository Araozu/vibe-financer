import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { transactionRepo } from '$lib/infra/repos/transaction.repo';
import { getAccountState, getAccountVersion } from '../account/account-projection';
import { canAcceptTransaction } from '$lib/domain/account-aggregate';
import { calculateNewBalance, type Transaction } from '$lib/domain/transaction';
import { createTransactionUpdatedEvent, type TransactionUpdatedPayload } from '$lib/domain/events';
import { error } from '@sveltejs/kit';
import { toUTC } from '$lib/domain/date-formatter';

export interface UpdateTransactionDTO {
	type?: 'expense' | 'income' | 'transfer';
	amount?: number;
	name?: string | null;
	description?: string | null;
	category?: string | null;
	payee?: string | null;
	toAccountId?: string | null;
	transactionDate?: Date;
}

/**
 * Edit an existing transaction and persist as a TransactionUpdated event.
 *
 * @param transactionId - The ID of the transaction to edit
 * @param updates - The fields to update
 * @param userId - The ID of the user making the edit (for audit trail)
 * @returns The updated transaction
 *
 * Note: This implementation handles simple transactions (income/expense).
 * Transfer transaction edits are not yet supported due to multi-account complexity.
 */
export async function editTransaction(
	transactionId: string,
	updates: UpdateTransactionDTO,
	userId: string
): Promise<Transaction> {
	// 1. Get the current transaction from the read model
	const currentTransaction = await transactionRepo.findById(transactionId);

	if (!currentTransaction) {
		throw error(404, 'Transaction not found');
	}

	// 2. For now, don't support editing transfers (would require multi-account event coordination)
	if (currentTransaction.type === 'transfer' || updates.type === 'transfer') {
		throw error(400, 'Editing transfers is not yet supported');
	}

	// 3. Get the account state to validate and calculate balance changes
	const account = await getAccountState(currentTransaction.accountId);

	if (!account || !canAcceptTransaction(account)) {
		throw error(404, 'Account not found or deleted');
	}

	const accountVersion = await getAccountVersion(currentTransaction.accountId);

	// 4. Build the changes and previous values objects
	const changes: UpdateTransactionDTO = {};
	const previousValues: UpdateTransactionDTO = {};

	if (updates.type !== undefined && updates.type !== currentTransaction.type) {
		changes.type = updates.type;
		previousValues.type = currentTransaction.type;
	}
	if (updates.amount !== undefined && updates.amount !== currentTransaction.amount) {
		changes.amount = updates.amount;
		previousValues.amount = currentTransaction.amount;
	}
	if (updates.name !== undefined && updates.name !== currentTransaction.name) {
		changes.name = updates.name;
		previousValues.name = currentTransaction.name;
	}
	if (updates.description !== undefined && updates.description !== currentTransaction.description) {
		changes.description = updates.description;
		previousValues.description = currentTransaction.description;
	}
	if (updates.category !== undefined && updates.category !== currentTransaction.category) {
		changes.category = updates.category;
		previousValues.category = currentTransaction.category;
	}
	if (updates.payee !== undefined && updates.payee !== currentTransaction.payee) {
		changes.payee = updates.payee;
		previousValues.payee = currentTransaction.payee;
	}
	if (updates.toAccountId !== undefined && updates.toAccountId !== currentTransaction.toAccountId) {
		changes.toAccountId = updates.toAccountId;
		previousValues.toAccountId = currentTransaction.toAccountId;
	}
	if (updates.transactionDate !== undefined) {
		const currentDate = currentTransaction.createdAt;
		const newDate = updates.transactionDate;
		if (currentDate.getTime() !== newDate.getTime()) {
			changes.transactionDate = newDate;
			previousValues.transactionDate = currentDate;
		}
	}

	// 5. If no changes, return the current transaction
	if (Object.keys(changes).length === 0) {
		return currentTransaction;
	}

	// 6. Calculate the balance adjustment
	// We need to reverse the old transaction and apply the new one
	const finalType = changes.type ?? currentTransaction.type;
	const finalAmount = changes.amount ?? currentTransaction.amount;

	// Reverse the old transaction's impact
	let balanceAfterReverse = account.currentBalance;
	if (currentTransaction.type === 'income') {
		balanceAfterReverse -= currentTransaction.amount;
	} else if (currentTransaction.type === 'expense') {
		balanceAfterReverse += currentTransaction.amount;
	}

	// Apply the new transaction
	const balanceAfter = calculateNewBalance(balanceAfterReverse, finalAmount, finalType);
	const balanceAdjustment = balanceAfter - account.currentBalance;

	// 7. Create the TransactionUpdated event
	const payload: TransactionUpdatedPayload = {
		transactionId,
		changes,
		previousValues,
		balanceAdjustment,
		balanceBefore: account.currentBalance,
		balanceAfter
	};

	const event = createTransactionUpdatedEvent(
		currentTransaction.accountId,
		userId,
		payload,
		accountVersion + 1
	);

	// 8. Append event with optimistic concurrency
	try {
		await eventStoreRepo.append(event, { expectedVersion: accountVersion });
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw error(409, 'Concurrent update detected while editing transaction. Please retry.');
		}
		throw err;
	}

	// 9. Update account read model
	await eventStoreRepo.updateAccountProjection(currentTransaction.accountId, {
		currentBalance: balanceAfter
	});

	// 10. Update transaction read model
	const updatedData: Partial<Transaction> = {};
	if (changes.type) updatedData.type = changes.type;
	if (changes.amount) updatedData.amount = changes.amount;
	if (changes.name !== undefined) updatedData.name = changes.name;
	if (changes.description !== undefined) updatedData.description = changes.description;
	if (changes.category !== undefined) updatedData.category = changes.category;
	if (changes.payee !== undefined) updatedData.payee = changes.payee;
	if (changes.toAccountId !== undefined) updatedData.toAccountId = changes.toAccountId;

	const updated = await transactionRepo.update(transactionId, updatedData);

	if (!updated) {
		throw error(500, 'Failed to update transaction projection');
	}

	return updated;
}
