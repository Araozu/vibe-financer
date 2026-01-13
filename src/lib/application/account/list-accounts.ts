import { accountRepo } from '../../infra/repos/account.repo';
import type { Account } from '../../domain/account';

export async function listAccounts(): Promise<Account[]> {
	return await accountRepo.findAll();
}
