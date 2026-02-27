import { error } from '@sveltejs/kit';
import { createAccountDeletedEvent, type AccountDeletedPayload } from '$lib/domain/events';
import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { getAccountState, getAccountVersion } from './account-projection';

export async function disableAccount(accountId: string, userId: string, reason?: string): Promise<void> {
	const account = await getAccountState(accountId);
	if (!account) {
		throw error(404, 'Account not found');
	}

	if (account.userId !== userId) {
		throw error(403, 'Forbidden');
	}

	if (account.isDeleted) {
		throw error(400, 'Account already disabled');
	}

	const currentVersion = await getAccountVersion(accountId);
	const payload: AccountDeletedPayload = { reason };
	const event = createAccountDeletedEvent(accountId, userId, payload, currentVersion + 1);

	try {
		await eventStoreRepo.runInTransaction(async (dbTx) => {
			await eventStoreRepo.append(event, { expectedVersion: currentVersion }, dbTx);
			await eventStoreRepo.deleteAccountProjection(accountId, dbTx);
		});
	} catch (err: unknown) {
		const e = err as { name?: string };
		if (e?.name === 'ConcurrencyError') {
			throw error(409, 'Concurrent update detected while disabling account. Please retry.');
		}
		throw err;
	}
}
