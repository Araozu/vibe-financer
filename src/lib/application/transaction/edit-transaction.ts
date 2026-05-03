import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { transactionRepo } from '$lib/infra/repos/transaction.repo';
import { getAccountState, getAccountVersion } from '../account/account-projection';
import { canAcceptTransaction } from '$lib/domain/account-aggregate';
import { calculateNewBalance, type Transaction } from '$lib/domain/transaction';
import { createTransactionUpdatedEvent, type TransactionUpdatedPayload } from '$lib/domain/events';
import { error } from '@sveltejs/kit';
import { toUTC } from '$lib/domain/date-formatter';

const VALID_TRANSACTION_TYPES: ReadonlySet<string> = new Set(['expense', 'income', 'transfer']);

export interface UpdateTransactionDTO {
	accountId?: string;
	type?: 'expense' | 'income' | 'transfer';
	amount?: number;
	name?: string | null;
	description?: string | null;
	category?: string | null;
	budgetId?: string | null;
	payee?: string | null;
	toAccountId?: string | null;
	transactionDate?: Date;
}

/**
 * Edit an existing transaction and persist as TransactionUpdated event(s).
 *
 * Supports:
 * - Changing type (expense <-> income) with correct balance recalculation
 * - Changing the account (moves transaction between accounts, emits events on both streams)
 * - Changing category (updates related budget projections)
 * - Changing amount, name, description, payee, date
 *
 * Transfer edits remain restricted to non-financial fields.
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

	// 1b. Validate inputs
	if (updates.amount !== undefined && updates.amount <= 0) {
		throw error(400, 'Transaction amount must be greater than zero');
	}

	if (updates.type !== undefined && !VALID_TRANSACTION_TYPES.has(updates.type)) {
		throw error(400, `Invalid transaction type: ${updates.type}`);
	}

	// 2. Block financial edits on transfers (multi-account coordination is complex)
	if (currentTransaction.type === 'transfer' || updates.type === 'transfer') {
		const isFinancialChange =
			(updates.amount !== undefined && updates.amount !== currentTransaction.amount) ||
			(updates.type !== undefined && updates.type !== currentTransaction.type) ||
			(updates.toAccountId !== undefined &&
				updates.toAccountId !== currentTransaction.toAccountId) ||
			(updates.accountId !== undefined && updates.accountId !== currentTransaction.accountId);

		if (isFinancialChange) {
			throw error(
				400,
				'Editing transfer amounts or accounts is not yet supported. Please delete and recreate the transfer.'
			);
		}
	}

	// 3. Detect account change
	const isAccountChange =
		updates.accountId !== undefined && updates.accountId !== currentTransaction.accountId;

	// 4. Build the changes and previous values objects
	const changes: UpdateTransactionDTO = {};
	const previousValues: UpdateTransactionDTO = {};

	if (isAccountChange) {
		changes.accountId = updates.accountId;
		previousValues.accountId = currentTransaction.accountId;
	}
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
	if (
		updates.budgetId !== undefined &&
		updates.budgetId !== (currentTransaction.budgetId ?? null)
	) {
		changes.budgetId = updates.budgetId;
		previousValues.budgetId = currentTransaction.budgetId ?? null;
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
		const newDate = toUTC(updates.transactionDate);
		if (currentDate.getTime() !== newDate.getTime()) {
			changes.transactionDate = newDate;
			previousValues.transactionDate = currentDate;
		}
	}

	// 5. If no changes, return the current transaction
	if (Object.keys(changes).length === 0) {
		return currentTransaction;
	}

	const finalType = changes.type ?? currentTransaction.type;
	const finalAmount = changes.amount ?? currentTransaction.amount;

	let updated: Transaction;

	if (isAccountChange) {
		updated = await handleAccountChange(
			transactionId,
			currentTransaction,
			updates,
			changes,
			previousValues,
			finalType,
			finalAmount,
			userId
		);
	} else {
		updated = await handleSameAccountEdit(
			transactionId,
			currentTransaction,
			changes,
			previousValues,
			finalType,
			finalAmount,
			userId
		);
	}

	// Update budget projections
	await updateBudgetProjections(currentTransaction, updates);

	return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Same-account edit: one event on the existing account stream
// ─────────────────────────────────────────────────────────────────────────────
async function handleSameAccountEdit(
	transactionId: string,
	currentTransaction: Transaction,
	changes: UpdateTransactionDTO,
	previousValues: UpdateTransactionDTO,
	finalType: string,
	finalAmount: number,
	userId: string
): Promise<Transaction> {
	const account = await getAccountState(currentTransaction.accountId);
	if (!account || !canAcceptTransaction(account)) {
		throw error(404, 'Account not found or deleted');
	}
	if (account.userId !== userId) {
		throw error(403, 'Forbidden');
	}
	const accountVersion = await getAccountVersion(currentTransaction.accountId);

	// Reverse old transaction impact, then apply new
	let balanceAfterReverse = account.currentBalance;
	if (currentTransaction.type === 'income') {
		balanceAfterReverse -= currentTransaction.amount;
	} else if (currentTransaction.type === 'expense') {
		balanceAfterReverse += currentTransaction.amount;
	}

	const balanceAfter = calculateNewBalance(
		balanceAfterReverse,
		finalAmount,
		finalType as 'expense' | 'income' | 'transfer'
	);
	const balanceAdjustment = balanceAfter - account.currentBalance;

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

	try {
		await eventStoreRepo.runInTransaction(async (tx) => {
			await eventStoreRepo.append(event, { expectedVersion: accountVersion }, tx);
			await eventStoreRepo.updateAccountProjection(
				currentTransaction.accountId,
				{ currentBalance: balanceAfter },
				tx
			);
			await eventStoreRepo.updateTransactionProjection(
				transactionId,
				buildTransactionProjectionData(changes),
				tx
			);
		});
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw error(409, 'Concurrent update detected while editing transaction. Please retry.');
		}
		throw err;
	}

	return buildUpdatedTransaction(currentTransaction, changes);
}

// ─────────────────────────────────────────────────────────────────────────────
// Account change: two events on two account streams
// ─────────────────────────────────────────────────────────────────────────────
async function handleAccountChange(
	transactionId: string,
	currentTransaction: Transaction,
	updates: UpdateTransactionDTO,
	changes: UpdateTransactionDTO,
	previousValues: UpdateTransactionDTO,
	finalType: string,
	finalAmount: number,
	userId: string
): Promise<Transaction> {
	const newAccountId = updates.accountId!;

	// Validate both accounts
	const [oldAccount, newAccount] = await Promise.all([
		getAccountState(currentTransaction.accountId),
		getAccountState(newAccountId)
	]);

	if (!oldAccount || !canAcceptTransaction(oldAccount) || oldAccount.userId !== userId) {
		throw error(404, 'Current account not found, deleted, or access denied');
	}
	if (!newAccount || !canAcceptTransaction(newAccount) || newAccount.userId !== userId) {
		throw error(404, 'Target account not found, deleted, or access denied');
	}

	const [oldAccountVersion, newAccountVersion] = await Promise.all([
		getAccountVersion(currentTransaction.accountId),
		getAccountVersion(newAccountId)
	]);

	// A. Reverse the transaction's impact on the OLD account
	let oldBalanceAdjustment: number;
	if (currentTransaction.type === 'income') {
		oldBalanceAdjustment = -currentTransaction.amount;
	} else {
		// expense or transfer
		oldBalanceAdjustment = currentTransaction.amount;
	}
	const oldBalanceAfter = oldAccount.currentBalance + oldBalanceAdjustment;

	const oldPayload: TransactionUpdatedPayload = {
		transactionId,
		changes: { accountId: newAccountId },
		previousValues: { accountId: currentTransaction.accountId },
		balanceAdjustment: oldBalanceAdjustment,
		balanceBefore: oldAccount.currentBalance,
		balanceAfter: oldBalanceAfter
	};

	const oldEvent = createTransactionUpdatedEvent(
		currentTransaction.accountId,
		userId,
		oldPayload,
		oldAccountVersion + 1
	);

	// B. Apply the (potentially modified) transaction to the NEW account
	const newBalanceBefore = newAccount.currentBalance;
	const newBalanceAfter = calculateNewBalance(
		newBalanceBefore,
		finalAmount,
		finalType as 'expense' | 'income' | 'transfer'
	);
	const newBalanceAdjustment = newBalanceAfter - newBalanceBefore;

	const newPayload: TransactionUpdatedPayload = {
		transactionId,
		changes,
		previousValues,
		balanceAdjustment: newBalanceAdjustment,
		balanceBefore: newBalanceBefore,
		balanceAfter: newBalanceAfter
	};

	const newEvent = createTransactionUpdatedEvent(
		newAccountId,
		userId,
		newPayload,
		newAccountVersion + 1
	);

	// C. Append events and update projections atomically
	try {
		await eventStoreRepo.runInTransaction(async (tx) => {
			await eventStoreRepo.append(oldEvent, { expectedVersion: oldAccountVersion }, tx);
			await eventStoreRepo.append(newEvent, { expectedVersion: newAccountVersion }, tx);

			await eventStoreRepo.updateAccountProjection(
				currentTransaction.accountId,
				{ currentBalance: oldBalanceAfter },
				tx
			);
			await eventStoreRepo.updateAccountProjection(
				newAccountId,
				{ currentBalance: newBalanceAfter },
				tx
			);

			await eventStoreRepo.updateTransactionProjection(
				transactionId,
				{ accountId: newAccountId, ...buildTransactionProjectionData(changes) },
				tx
			);
		});
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw error(409, 'Concurrent update detected while editing transaction. Please retry.');
		}
		throw err;
	}

	return buildUpdatedTransaction({ ...currentTransaction, accountId: newAccountId }, changes);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the projection data object for updateTransactionProjection from a set of changes.
 */
function buildTransactionProjectionData(changes: UpdateTransactionDTO): {
	type?: 'expense' | 'income' | 'transfer';
	amount?: number;
	name?: string | null;
	description?: string | null;
	category?: string | null;
	budgetId?: string | null;
	payee?: string | null;
	toAccountId?: string | null;
	createdAt?: Date;
} {
	const data: {
		type?: 'expense' | 'income' | 'transfer';
		amount?: number;
		name?: string | null;
		description?: string | null;
		category?: string | null;
		budgetId?: string | null;
		payee?: string | null;
		toAccountId?: string | null;
		createdAt?: Date;
	} = {};
	if (changes.type !== undefined) data.type = changes.type;
	if (changes.amount !== undefined) data.amount = changes.amount;
	if (changes.name !== undefined) data.name = changes.name;
	if (changes.description !== undefined) data.description = changes.description;
	if (changes.category !== undefined) data.category = changes.category;
	if (changes.budgetId !== undefined) data.budgetId = changes.budgetId;
	if (changes.payee !== undefined) data.payee = changes.payee;
	if (changes.toAccountId !== undefined) data.toAccountId = changes.toAccountId;
	if (changes.transactionDate !== undefined) data.createdAt = toUTC(changes.transactionDate);
	return data;
}

/**
 * Build an updated Transaction object in memory from the current transaction and a set of changes,
 * avoiding an extra database round-trip.
 *
 * Note: `!== undefined` is used instead of `??` for all fields because nullable fields such as
 * `name` can be explicitly set to `null` (meaning "clear the field"). Using `??` would treat
 * `null` as a missing value and fall back to the current value, silently ignoring the clear.
 */
function buildUpdatedTransaction(current: Transaction, changes: UpdateTransactionDTO): Transaction {
	return {
		...current,
		type: changes.type !== undefined ? changes.type : current.type,
		amount: changes.amount !== undefined ? changes.amount : current.amount,
		name: changes.name !== undefined ? changes.name : current.name,
		description: changes.description !== undefined ? changes.description : current.description,
		category: changes.category !== undefined ? changes.category : current.category,
		budgetId: changes.budgetId !== undefined ? changes.budgetId : current.budgetId,
		payee: changes.payee !== undefined ? changes.payee : current.payee,
		toAccountId: changes.toAccountId !== undefined ? changes.toAccountId : current.toAccountId,
		createdAt:
			changes.transactionDate !== undefined ? toUTC(changes.transactionDate) : current.createdAt,
		updatedAt: new Date()
	};
}

/**
 * Update budget projections when a transaction is edited.
 *
 * Strategy: reverse the old impact (if it was an expense with a category),
 * then apply the new impact (if it is an expense with a category).
 * This correctly handles:
 * - Category changes (old budget loses spend, new budget gains spend)
 * - Type changes (expense→income removes from budget; income→expense adds to budget)
 * - Amount changes
 * - Combined changes (type + category + amount all at once)
 */
async function updateBudgetProjections(
	currentTransaction: Transaction,
	updates: UpdateTransactionDTO
): Promise<void> {
	const oldCategory = currentTransaction.category;
	const newCategory =
		updates.category !== undefined ? updates.category : currentTransaction.category;
	const oldAmount = currentTransaction.amount;
	const newAmount = updates.amount !== undefined ? updates.amount : currentTransaction.amount;
	const oldType = currentTransaction.type;
	const newType = updates.type !== undefined ? updates.type : currentTransaction.type;

	// Only touch budgets if the transaction is/was an expense with a category
	if ((oldCategory && oldType === 'expense') || (newCategory && newType === 'expense')) {
		// 1. Reverse the old impact if it was an expense with a category
		if (oldCategory && oldType === 'expense') {
			const oldActiveBudgets = await eventStoreRepo.getActiveBudgetsByCategory(
				oldCategory,
				currentTransaction.createdAt
			);
			for (const b of oldActiveBudgets) {
				await eventStoreRepo.updateBudgetProjection(b.id, {
					currentSpent: b.currentSpent - oldAmount
				});
			}
		}

		// 2. Apply the new impact if it is an expense with a category
		if (newCategory && newType === 'expense') {
			const txDate = updates.transactionDate
				? toUTC(updates.transactionDate)
				: currentTransaction.createdAt;
			const newActiveBudgets = await eventStoreRepo.getActiveBudgetsByCategory(newCategory, txDate);
			for (const b of newActiveBudgets) {
				await eventStoreRepo.updateBudgetProjection(b.id, {
					currentSpent: b.currentSpent + newAmount
				});
			}
		}
	}
}
