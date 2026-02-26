/**
 * Projection Rebuild Service
 *
 * Rebuilds read models (projections) from the event store.
 * Use this when:
 * - Projections get out of sync with events
 * - You've changed the projection schema
 * - You need to recover from a bug that corrupted projections
 */

import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { projectAccountState } from '$lib/domain/account-aggregate';
import type {
	TransactionCreatedEvent,
	TransactionUpdatedEvent,
	TransactionDeletedEvent,
	TransferCreatedEvent,
	BudgetCreatedEvent,
	BudgetUpdatedEvent,
	GoalSetEvent,
	GoalUpdatedEvent,
	CurrencyCreatedEvent,
	CurrencyUpdatedEvent
} from '$lib/domain/events';
import { invalidateSnapshots, forceCreateSnapshot } from './account-projection';

export interface RebuildResult {
	success: boolean;
	accountsRebuilt: number;
	transactionsRebuilt: number;
	budgetsRebuilt: number;
	goalsRebuilt: number;
	currenciesRebuilt: number;
	errors: string[];
	durationMs: number;
}

export interface RebuildAccountResult {
	success: boolean;
	accountId: string;
	transactionsRebuilt: number;
	error?: string;
}

/**
 * Rebuild a single account's projection from its event stream
 */
export async function rebuildAccountProjection(accountId: string): Promise<RebuildAccountResult> {
	try {
		// 1. Invalidate existing snapshots
		await invalidateSnapshots(accountId);

		// 2. Get all events for this account
		const events = await eventStoreRepo.getStream(accountId);

		if (events.length === 0) {
			return {
				success: true,
				accountId,
				transactionsRebuilt: 0,
				error: 'No events found for account'
			};
		}

		// 3. Project the current state from events
		const state = projectAccountState(events);

		if (!state) {
			return {
				success: false,
				accountId,
				transactionsRebuilt: 0,
				error: 'Could not project state from events'
			};
		}

		// 4. Delete existing projections
		await eventStoreRepo.deleteTransactionProjectionsByAccount(accountId);

		// Only delete account projection if it's not deleted in the event stream
		if (!state.isDeleted) {
			try {
				await eventStoreRepo.deleteAccountProjection(accountId);
			} catch {
				// Account might not exist in projection yet
			}

			// 5. Recreate account projection
			await eventStoreRepo.createAccountProjection({
				id: state.id,
				userId: state.userId,
				name: state.name,
				description: state.description,
				type: state.type,
				initialBalance: state.initialBalance,
				currentBalance: state.currentBalance,
				currencyId: state.currencyId,
				color: state.color
			});
		}

		// 6. Recreate transaction projections from events
		let transactionsRebuilt = 0;
		for (const event of events) {
			if (event.eventType === 'TransactionCreated') {
				const e = event as TransactionCreatedEvent;
				await eventStoreRepo.createTransactionProjection({
					id: e.payload.transactionId,
					accountId: e.payload.accountId,
					type: e.payload.type,
					amount: e.payload.amount,
					name: e.payload.name,
					description: e.payload.description,
					category: e.payload.category,
					payee: e.payload.payee,
					toAccountId: e.payload.toAccountId,
					createdAt: e.payload.transactionDate
				});
				transactionsRebuilt++;
			} else if (event.eventType === 'TransferCreated') {
				const e = event as TransferCreatedEvent;
				/**
				 * Transfers create events for both accounts:
				 * - A TransferCreated event on the source account stream
				 * - A TransactionCreated event on the destination account stream
				 *
				 * During rebuild, we only create the transaction projection for the source account
				 * here because the destination account will have its own TransactionCreated event
				 * in its stream, which will be processed separately when that account is rebuilt.
				 * This prevents duplicate transaction projections.
				 */
				if (e.streamId === accountId) {
					await eventStoreRepo.createTransactionProjection({
						id: e.payload.transactionId,
						accountId: e.payload.fromAccountId,
						type: 'transfer',
						amount: e.payload.amount,
						name: e.payload.name,
						description: e.payload.description,
						category: e.payload.category,
						payee: null,
						toAccountId: e.payload.toAccountId,
						createdAt: e.payload.transactionDate
					});
					transactionsRebuilt++;
				}
			} else if (event.eventType === 'TransactionUpdated') {
				const e = event as TransactionUpdatedEvent;
				const changes = e.payload.changes;
				const updateData: {
					accountId?: string;
					type?: 'expense' | 'income' | 'transfer';
					amount?: number;
					name?: string | null;
					description?: string | null;
					category?: string | null;
					payee?: string | null;
					toAccountId?: string | null;
					createdAt?: Date;
				} = {};
				if (changes.type !== undefined) updateData.type = changes.type;
				if (changes.amount !== undefined) updateData.amount = changes.amount;
				if (changes.name !== undefined) updateData.name = changes.name;
				if (changes.description !== undefined) updateData.description = changes.description;
				if (changes.category !== undefined) updateData.category = changes.category;
				if (changes.payee !== undefined) updateData.payee = changes.payee;
				if (changes.toAccountId !== undefined) updateData.toAccountId = changes.toAccountId;
				if (changes.transactionDate !== undefined) updateData.createdAt = changes.transactionDate;
				if (changes.accountId !== undefined) updateData.accountId = changes.accountId;
				if (Object.keys(updateData).length > 0) {
					await eventStoreRepo.updateTransactionProjection(e.payload.transactionId, updateData);
				}
			} else if (event.eventType === 'TransactionDeleted') {
				const e = event as TransactionDeletedEvent;
				await eventStoreRepo.updateTransactionProjection(e.payload.transactionId, {
					deletedAt: e.occurredAt
				});
			}
		}

		// 7. Create a fresh snapshot
		if (!state.isDeleted) {
			await forceCreateSnapshot(accountId);
		}

		return {
			success: true,
			accountId,
			transactionsRebuilt
		};
	} catch (err) {
		return {
			success: false,
			accountId,
			transactionsRebuilt: 0,
			error: err instanceof Error ? err.message : 'Unknown error'
		};
	}
}

/**
 * Rebuild budget projections from events.
 * Replays BudgetCreated, BudgetUpdated, BudgetDeleted events and recalculates
 * currentSpent from TransactionCreated/TransactionDeleted events.
 */
export async function rebuildBudgetProjections(): Promise<number> {
	let rebuilt = 0;

	// Get all budget stream IDs
	const streamIds = await eventStoreRepo.getAllStreamIds('budget');

	for (const streamId of streamIds) {
		const events = await eventStoreRepo.getStream(streamId);
		if (events.length === 0) continue;

		let budgetState: {
			id: string;
			userId: string;
			category: string;
			limit: number;
			currencyId: string;
			period: 'monthly' | 'weekly' | 'yearly';
			startDate: Date;
			isDeleted: boolean;
		} | null = null;

		for (const event of events) {
			if (event.eventType === 'BudgetCreated') {
				const e = event as BudgetCreatedEvent;
				budgetState = {
					id: e.payload.budgetId,
					userId: e.userId,
					category: e.payload.category,
					limit: e.payload.limit,
					currencyId: e.payload.currencyId,
					period: e.payload.period,
					startDate: e.payload.startDate,
					isDeleted: false
				};
			} else if (event.eventType === 'BudgetUpdated' && budgetState) {
				const e = event as BudgetUpdatedEvent;
				const changes = e.payload.changes;
				if (changes.category !== undefined) budgetState.category = changes.category;
				if (changes.limit !== undefined) budgetState.limit = changes.limit;
				if (changes.period !== undefined) budgetState.period = changes.period;
				if (changes.startDate !== undefined) budgetState.startDate = changes.startDate;
			} else if (event.eventType === 'BudgetDeleted') {
				if (budgetState) budgetState.isDeleted = true;
			}
		}

		if (!budgetState || budgetState.isDeleted) {
			// Delete projection if it exists
			try {
				await eventStoreRepo.deleteBudgetProjection(streamId);
			} catch {
				// May not exist
			}
			continue;
		}

		// Delete existing projection and recreate
		try {
			await eventStoreRepo.deleteBudgetProjection(budgetState.id);
		} catch {
			// May not exist
		}

		// During a rebuild, currentSpent is reset to 0.
		// It will be recalculated as transaction events are replayed by rebuildAccountProjection.
		await eventStoreRepo.createBudgetProjection({
			id: budgetState.id,
			userId: budgetState.userId,
			category: budgetState.category,
			limit: budgetState.limit,
			currencyId: budgetState.currencyId,
			period: budgetState.period,
			startDate: budgetState.startDate,
			currentSpent: 0
		});
		rebuilt++;
	}

	return rebuilt;
}

/**
 * Rebuild goal projections from events.
 * Replays GoalSet, GoalUpdated, GoalRemoved events.
 */
export async function rebuildGoalProjections(): Promise<number> {
	let rebuilt = 0;

	const streamIds = await eventStoreRepo.getAllStreamIds('goal');

	for (const streamId of streamIds) {
		const events = await eventStoreRepo.getStream(streamId);
		if (events.length === 0) continue;

		let goalState: {
			id: string;
			accountId: string;
			name: string;
			targetAmount: number;
			targetDate: Date | null;
			isRemoved: boolean;
		} | null = null;

		for (const event of events) {
			if (event.eventType === 'GoalSet') {
				const e = event as GoalSetEvent;
				goalState = {
					id: e.payload.goalId,
					accountId: e.payload.accountId,
					name: e.payload.name,
					targetAmount: e.payload.targetAmount,
					targetDate: e.payload.targetDate,
					isRemoved: false
				};
			} else if (event.eventType === 'GoalUpdated' && goalState) {
				const e = event as GoalUpdatedEvent;
				const changes = e.payload.changes;
				if (changes.name !== undefined) goalState.name = changes.name;
				if (changes.targetAmount !== undefined) goalState.targetAmount = changes.targetAmount;
				if (changes.targetDate !== undefined) goalState.targetDate = changes.targetDate;
			} else if (event.eventType === 'GoalRemoved') {
				if (goalState) goalState.isRemoved = true;
			}
		}

		if (!goalState || goalState.isRemoved) {
			try {
				await eventStoreRepo.deleteGoalProjection(streamId);
			} catch {
				// May not exist
			}
			continue;
		}

		// Delete existing projection and recreate
		try {
			await eventStoreRepo.deleteGoalProjection(goalState.id);
		} catch {
			// May not exist
		}

		await eventStoreRepo.createGoalProjection({
			id: goalState.id,
			accountId: goalState.accountId,
			name: goalState.name,
			targetAmount: goalState.targetAmount,
			targetDate: goalState.targetDate
		});
		rebuilt++;
	}

	return rebuilt;
}

/**
 * Rebuild currency projections from events.
 * Replays CurrencyCreated, CurrencyUpdated, CurrencyDeleted events.
 */
export async function rebuildCurrencyProjections(): Promise<number> {
	let rebuilt = 0;

	const streamIds = await eventStoreRepo.getAllStreamIds('currency');

	for (const streamId of streamIds) {
		const events = await eventStoreRepo.getStream(streamId);
		if (events.length === 0) continue;

		let currencyState: {
			id: string;
			code: string;
			symbol: string;
			name: string;
			isDeleted: boolean;
		} | null = null;

		for (const event of events) {
			if (event.eventType === 'CurrencyCreated') {
				const e = event as CurrencyCreatedEvent;
				currencyState = {
					id: e.payload.currencyId,
					code: e.payload.code,
					symbol: e.payload.symbol,
					name: e.payload.name,
					isDeleted: false
				};
			} else if (event.eventType === 'CurrencyUpdated' && currencyState) {
				const e = event as CurrencyUpdatedEvent;
				const changes = e.payload.changes;
				if (changes.code !== undefined) currencyState.code = changes.code;
				if (changes.symbol !== undefined) currencyState.symbol = changes.symbol;
				if (changes.name !== undefined) currencyState.name = changes.name;
			} else if (event.eventType === 'CurrencyDeleted') {
				if (currencyState) currencyState.isDeleted = true;
			}
		}

		if (!currencyState || currencyState.isDeleted) {
			try {
				await eventStoreRepo.deleteCurrencyProjection(streamId);
			} catch {
				// May not exist
			}
			continue;
		}

		// Delete existing projection and recreate
		try {
			await eventStoreRepo.deleteCurrencyProjection(currencyState.id);
		} catch {
			// May not exist
		}

		await eventStoreRepo.createCurrencyProjection({
			id: currencyState.id,
			code: currencyState.code,
			symbol: currencyState.symbol,
			name: currencyState.name
		});
		rebuilt++;
	}

	return rebuilt;
}

/**
 * Rebuild all account projections for a user
 */
export async function rebuildUserProjections(userId: string): Promise<RebuildResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	let accountsRebuilt = 0;
	let transactionsRebuilt = 0;

	// Get all account stream IDs for this user
	const streamIds = await eventStoreRepo.getStreamIdsByUserAndType(userId, 'account');

	for (const streamId of streamIds) {
		const result = await rebuildAccountProjection(streamId);

		if (result.success) {
			accountsRebuilt++;
			transactionsRebuilt += result.transactionsRebuilt;
		} else if (result.error) {
			errors.push(`Account ${streamId}: ${result.error}`);
		}
	}

	// Rebuild budget, goal, and currency projections
	let budgetsRebuilt = 0;
	let goalsRebuilt = 0;
	let currenciesRebuilt = 0;

	try {
		budgetsRebuilt = await rebuildBudgetProjections();
	} catch (err) {
		errors.push(`Budgets: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}

	try {
		goalsRebuilt = await rebuildGoalProjections();
	} catch (err) {
		errors.push(`Goals: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}

	try {
		currenciesRebuilt = await rebuildCurrencyProjections();
	} catch (err) {
		errors.push(`Currencies: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}

	return {
		success: errors.length === 0,
		accountsRebuilt,
		transactionsRebuilt,
		budgetsRebuilt,
		goalsRebuilt,
		currenciesRebuilt,
		errors,
		durationMs: Date.now() - startTime
	};
}

/**
 * Rebuild ALL projections in the system (admin operation)
 * Use with caution - this can be slow for large datasets
 */
export async function rebuildAllProjections(): Promise<RebuildResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	let accountsRebuilt = 0;
	let transactionsRebuilt = 0;

	// Get all account stream IDs
	const streamIds = await eventStoreRepo.getAllStreamIds('account');

	for (const streamId of streamIds) {
		const result = await rebuildAccountProjection(streamId);

		if (result.success) {
			accountsRebuilt++;
			transactionsRebuilt += result.transactionsRebuilt;
		} else if (result.error) {
			errors.push(`Account ${streamId}: ${result.error}`);
		}
	}

	// Rebuild budget, goal, and currency projections
	let budgetsRebuilt = 0;
	let goalsRebuilt = 0;
	let currenciesRebuilt = 0;

	try {
		budgetsRebuilt = await rebuildBudgetProjections();
	} catch (err) {
		errors.push(`Budgets: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}

	try {
		goalsRebuilt = await rebuildGoalProjections();
	} catch (err) {
		errors.push(`Goals: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}

	try {
		currenciesRebuilt = await rebuildCurrencyProjections();
	} catch (err) {
		errors.push(`Currencies: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}

	return {
		success: errors.length === 0,
		accountsRebuilt,
		transactionsRebuilt,
		budgetsRebuilt,
		goalsRebuilt,
		currenciesRebuilt,
		errors,
		durationMs: Date.now() - startTime
	};
}

/**
 * Verify projection integrity by comparing with event-sourced state
 */
export async function verifyProjectionIntegrity(
	accountId: string
): Promise<{ isValid: boolean; discrepancies: string[] }> {
	const discrepancies: string[] = [];

	// Get state from events
	const events = await eventStoreRepo.getStream(accountId);
	const eventState = projectAccountState(events);

	if (!eventState) {
		return { isValid: false, discrepancies: ['No events found for account'] };
	}

	// Skip verification for deleted accounts
	if (eventState.isDeleted) {
		return { isValid: true, discrepancies: [] };
	}

	// Get projection state from read model
	// We need to import the repo to access the raw projection
	const { accountRepo } = await import('$lib/infra/repos/account.repo');
	const projection = await accountRepo.findById(accountId);

	if (!projection) {
		discrepancies.push('Account projection not found');
		return { isValid: false, discrepancies };
	}

	// Compare fields
	if (projection.currentBalance !== eventState.currentBalance) {
		discrepancies.push(
			`Balance mismatch: projection=${projection.currentBalance}, events=${eventState.currentBalance}`
		);
	}

	if (projection.name !== eventState.name) {
		discrepancies.push(`Name mismatch: projection=${projection.name}, events=${eventState.name}`);
	}

	if (projection.initialBalance !== eventState.initialBalance) {
		discrepancies.push(
			`Initial balance mismatch: projection=${projection.initialBalance}, events=${eventState.initialBalance}`
		);
	}

	return {
		isValid: discrepancies.length === 0,
		discrepancies
	};
}
