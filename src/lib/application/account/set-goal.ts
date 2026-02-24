import { error } from '@sveltejs/kit';
import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { getAccountState } from './account-projection';
import {
	createGoalSetEvent,
	createGoalUpdatedEvent,
	createGoalRemovedEvent
} from '$lib/domain/events';
import { toUTC } from '$lib/domain/date-formatter';

export interface SetGoalDTO {
	accountId: string;
	name: string;
	targetAmount: number;
	targetDate: Date | null;
}

/**
 * Set or update a goal for an account.
 */
export async function setGoal(userId: string, data: SetGoalDTO) {
	// 1. Verify account exists and belongs to user
	const account = await getAccountState(data.accountId);
	if (!account || account.userId !== userId) {
		throw error(404, 'Account not found');
	}

	// 2. Only allow savings accounts to have goals
	if (account.type !== 'savings') {
		throw error(400, 'Only savings accounts can have goals');
	}

	// 3. Check if goal already exists
	const existingGoal = await eventStoreRepo.getGoalByAccount(data.accountId);
	const currentVersion = await eventStoreRepo.getStreamVersion(existingGoal?.id ?? 'new-goal');

	if (existingGoal) {
		// Update existing goal
		const event = createGoalUpdatedEvent(
			existingGoal.id,
			userId,
			{
				changes: {
					name: data.name,
					targetAmount: data.targetAmount,
					targetDate: data.targetDate ? toUTC(data.targetDate) : null
				},
				previousValues: {
					name: existingGoal.name,
					targetAmount: existingGoal.targetAmount,
					targetDate: existingGoal.targetDate
				}
			},
			currentVersion + 1
		);

		await eventStoreRepo.append(event, { expectedVersion: currentVersion });
		await eventStoreRepo.updateGoalProjection(existingGoal.id, {
			name: data.name,
			targetAmount: data.targetAmount,
			targetDate: data.targetDate ? toUTC(data.targetDate) : null
		});

		return { id: existingGoal.id, ...data };
	} else {
		// Create new goal
		const goalId = crypto.randomUUID();
		const event = createGoalSetEvent(goalId, userId, {
			goalId,
			accountId: data.accountId,
			name: data.name,
			targetAmount: data.targetAmount,
			targetDate: data.targetDate ? toUTC(data.targetDate) : null
		});

		await eventStoreRepo.append(event);
		await eventStoreRepo.createGoalProjection({
			id: goalId,
			accountId: data.accountId,
			name: data.name,
			targetAmount: data.targetAmount,
			targetDate: data.targetDate ? toUTC(data.targetDate) : null
		});

		return { id: goalId, ...data };
	}
}

/**
 * Remove a goal from an account.
 */
export async function removeGoal(userId: string, accountId: string) {
	const account = await getAccountState(accountId);
	if (!account || account.userId !== userId) {
		throw error(404, 'Account not found');
	}

	const existingGoal = await eventStoreRepo.getGoalByAccount(accountId);
	if (!existingGoal) {
		return;
	}

	const currentVersion = await eventStoreRepo.getStreamVersion(existingGoal.id);
	const event = createGoalRemovedEvent(existingGoal.id, userId, {}, currentVersion + 1);

	await eventStoreRepo.append(event, { expectedVersion: currentVersion });
	await eventStoreRepo.deleteGoalProjection(existingGoal.id);
}
