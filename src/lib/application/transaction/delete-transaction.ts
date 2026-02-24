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

	if (!account || !canAcceptTransaction(account)) {
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
	try {
		await eventStoreRepo.append(event, { expectedVersion: accountVersion });
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw error(409, 'Concurrent update detected while deleting transaction. Please retry.');
		}
		throw err;
	}

	// 6. Update account projection with new balance
	const newBalance = account.currentBalance + balanceAdjustment;
	await eventStoreRepo.updateAccountProjection(tx.accountId, {
		currentBalance: newBalance
	});

	// 7. Update transaction projection to mark as deleted
	await eventStoreRepo.updateTransactionProjection(transactionId, {
		deletedAt: new Date()
	});

	// 8. Update budget projections
	// If the transaction was an expense and had a category, we need to reverse its impact
	if (tx.category && tx.type === 'expense') {
		const activeBudgets = await eventStoreRepo.getActiveBudgetsByCategory(
			tx.category,
			tx.createdAt
		);
		for (const b of activeBudgets) {
			await eventStoreRepo.updateBudgetProjection(b.id, {
				currentSpent: b.currentSpent - tx.amount
			});
		}
	}

	// 9. Handle transfers (reverse impact on destination account)
	if (tx.type === 'transfer' && tx.toAccountId) {
		const destAccount = await getAccountState(tx.toAccountId);
		if (destAccount && canAcceptTransaction(destAccount)) {
			const destVersion = await getAccountVersion(tx.toAccountId);
			
			// For destination account, the transfer was an income.
			// To delete it, we need to subtract the amount.
			const destBalanceAdjustment = -tx.amount;
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

			// Append event to destination stream
			try {
				await eventStoreRepo.append(destEvent, { expectedVersion: destVersion });
				
				// Update destination account read model
				await eventStoreRepo.updateAccountProjection(tx.toAccountId, {
					currentBalance: destAccount.currentBalance + destBalanceAdjustment
				});

				// Update transaction projection for the destination account side
				// Note: Transfers have a single transaction ID but may appear in multiple account views
				// We need to ensure the projection reflects the deletion for any view
				await eventStoreRepo.updateTransactionProjection(transactionId, {
					deletedAt: new Date()
				});
			} catch (err: unknown) {
				const e = err as { name?: string };
				if (e?.name === 'ConcurrencyError') {
					throw error(409, 'Concurrent update detected while reversing transfer on destination account. Please retry.');
				}
				throw err;
			}
		}
	}
}
