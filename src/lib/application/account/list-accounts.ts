import { accountRepo } from '../../infra/repos/account.repo';
import type { Account, Goal } from '../../domain/account';

/**
 * List all accounts (from read model for performance)
 * Use getUserAccounts from account-projection.ts for event-sourced queries
 */
export async function listAccounts(): Promise<Array<Account & { goal: Goal | null }>> {
	return await accountRepo.findAll();
}

/**
 * List accounts by user ID (from read model)
 */
export async function listAccountsByUser(
	userId: string
): Promise<Array<Account & { goal: Goal | null }>> {
	const allAccounts = await accountRepo.findAll();
	return allAccounts.filter((acc) => acc.userId === userId);
}

// Re-export projection queries for event-sourced access
export {
	getUserAccounts,
	getUserAccountsWithHistory,
	getAccountState,
	getAccountStateAsOf,
	getAccountWithHistory,
	getAccountBalanceAsOf,
	getAccountAuditTrail,
	getBalanceHistoryBetween,
	getNetWorthAsOf,
	getAllAccountBalancesAsOf
} from './account-projection';
