import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { transactionRepo } from '$lib/infra/repos/transaction.repo';
import { getAccountState, getAccountVersion } from '../account/account-projection';
import { canAcceptTransaction } from '$lib/domain/account-aggregate';
import { createTransactionDeletedEvent, type TransactionDeletedPayload } from '$lib/domain/events';
import { error } from '@sveltejs/kit';

/**
 * Delete a transaction by creating a TransactionDeleted event.
 * This is a soft delete that maintains the audit trail while removing the transaction from the UI.
 *
 * The deletion creates an inverse operation that adjusts the account balance back as if the
 * transaction never happened, but keeps all events for compliance and debugging.
 *
 * @param transactionId - The ID of the transaction to delete
 * @param userId - The ID of the user deleting the transaction (required for audit trail)
 * @param reason - Optional reason for deletion
 * @returns void
 */
export async function deleteTransaction(
	transactionId: string,
	userId: string,
	reason?: string
): Promise<void> {
	// 1. Get the transaction from the projection
	const tx = await transactionRepo.findById(transactionId);

	if (!tx) {
		throw error(404, 'Transaction not found');
	}

	if (tx.deletedAt) {
		throw error(400, 'Transaction already deleted');
	}

	// 2. Get the account state to validate and calculate balance adjustment
	const account = await getAccountState(tx.accountId);

	if (!account || !canAcceptTransaction(account) || account.userId !== userId) {
		throw error(404, 'Account not found or deleted');
	}

	const accountVersion = await getAccountVersion(tx.accountId);

	// 3. Calculate the inverse balance adjustment
	// For income: we added money, so adjustment is negative (remove it)
	// For expense/transfer: we subtracted money, so adjustment is positive (add it back)
	let balanceAdjustment: number;

	switch (tx.type) {
		case 'income':
			balanceAdjustment = -tx.amount;
			break;
		case 'expense':
		case 'transfer':
			balanceAdjustment = tx.amount;
			break;
	}

	// 4. Create the TransactionDeleted event
	const payload: TransactionDeletedPayload = {
		transactionId: tx.id,
		reason,
		balanceAdjustment
	};

	const event = createTransactionDeletedEvent(tx.accountId, userId, payload, accountVersion + 1);

	// 5. Append event with optimistic concurrency
	// For transfers, we need to wrap source + destination appends atomically
	if (tx.type === 'transfer' && tx.toAccountId) {
		const destAccount = await getAccountState(tx.toAccountId);
		if (destAccount && destAccount.userId !== userId) {
			throw error(404, 'Destination account not found');
		}
		if (destAccount && canAcceptTransaction(destAccount) && destAccount.userId === userId) {
			const destVersion = await getAccountVersion(tx.toAccountId);

			const destBalanceAdjustment = -(tx.destinationAmount ?? tx.amount);
			const destPayload: TransactionDeletedPayload = {
				transactionId: tx.id,
				reason: reason ? `${reason} (Transfer reversal)` : 'Transfer reversal',
				balanceAdjustment: destBalanceAdjustment
			};

			const destEvent = createTransactionDeletedEvent(
				tx.toAccountId,
				userId,
				destPayload,
				destVersion + 1
			);

			// Append both events and update projections atomically in a single transaction
			try {
				await eventStoreRepo.runInTransaction(async (dbTx) => {
					await eventStoreRepo.append(event, { expectedVersion: accountVersion }, dbTx);
					await eventStoreRepo.append(destEvent, { expectedVersion: destVersion }, dbTx);

					// Update both account projections
					const newBalance = account.currentBalance + balanceAdjustment;
					await eventStoreRepo.updateAccountProjection(
						tx.accountId,
						{ currentBalance: newBalance },
						dbTx
					);
					await eventStoreRepo.updateAccountProjection(
						tx.toAccountId!,
						{ currentBalance: destAccount.currentBalance + destBalanceAdjustment },
						dbTx
					);

					// Update transaction projection to mark as deleted
					await eventStoreRepo.updateTransactionProjection(
						transactionId,
						{ deletedAt: new Date() },
						dbTx
					);
				});
			} catch (err: unknown) {
				const e = err as { name?: string };
				if (e?.name === 'ConcurrencyError') {
					throw error(409, 'Concurrent update detected while deleting transfer. Please retry.');
				}
				throw err;
			}
		} else {
			// Destination account not found/deleted - only append source event
			try {
				await eventStoreRepo.runInTransaction(async (dbTx) => {
					await eventStoreRepo.append(event, { expectedVersion: accountVersion }, dbTx);
					const newBalance = account.currentBalance + balanceAdjustment;
					await eventStoreRepo.updateAccountProjection(
						tx.accountId,
						{ currentBalance: newBalance },
						dbTx
					);
					await eventStoreRepo.updateTransactionProjection(
						transactionId,
						{ deletedAt: new Date() },
						dbTx
					);
				});
			} catch (err: unknown) {
				const e = err as { name?: string };
				if (e?.name === 'ConcurrencyError') {
					throw error(409, 'Concurrent update detected while deleting transaction. Please retry.');
				}
				throw err;
			}
		}
	} else {
		// Non-transfer transaction
		try {
			await eventStoreRepo.runInTransaction(async (dbTx) => {
				await eventStoreRepo.append(event, { expectedVersion: accountVersion }, dbTx);
				const newBalance = account.currentBalance + balanceAdjustment;
				await eventStoreRepo.updateAccountProjection(
					tx.accountId,
					{ currentBalance: newBalance },
					dbTx
				);
				await eventStoreRepo.updateTransactionProjection(
					transactionId,
					{ deletedAt: new Date() },
					dbTx
				);
			});
		} catch (err: unknown) {
			const e = err as { name?: string };
			if (e?.name === 'ConcurrencyError') {
				throw error(409, 'Concurrent update detected while deleting transaction. Please retry.');
			}
			throw err;
		}
	}

	// 8. Update budget projections
	// If the transaction was an expense and had a category, we need to reverse its impact
	if (tx.category && tx.type === 'expense') {
		const activeBudgets = await eventStoreRepo.getActiveBudgetsByCategory(
			tx.category,
			tx.createdAt,
			userId,
			account.currencyId
		);
		for (const b of activeBudgets) {
			await eventStoreRepo.updateBudgetProjection(b.id, {
				currentSpent: b.currentSpent - tx.amount
			});
		}
	}
}
