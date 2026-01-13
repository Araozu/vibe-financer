import { transactionRepo } from '$lib/infra/repos/transaction.repo';
import type { Transaction } from '$lib/domain/transaction';

export async function listTransactions(): Promise<Transaction[]> {
	return await transactionRepo.findAll();
}

export async function listTransactionsByAccount(accountId: string): Promise<Transaction[]> {
	return await transactionRepo.findByAccountId(accountId);
}
