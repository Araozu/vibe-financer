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
import { projectAccountState, type AccountState } from '$lib/domain/account-aggregate';
import type {
	DomainEvent,
	TransactionCreatedEvent,
	TransferCreatedEvent
} from '$lib/domain/events';
import { invalidateSnapshots, forceCreateSnapshot } from './account-projection';

export interface RebuildResult {
	success: boolean;
	accountsRebuilt: number;
	transactionsRebuilt: number;
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

	return {
		success: errors.length === 0,
		accountsRebuilt,
		transactionsRebuilt,
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

	return {
		success: errors.length === 0,
		accountsRebuilt,
		transactionsRebuilt,
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
