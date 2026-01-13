import { db } from '$lib/infra/db';
import { account, transaction } from '$lib/infra/db/schema';
import { eq } from 'drizzle-orm';
import {
	calculateNewBalance,
	validateTransferAccounts,
	type CreateTransactionDTO,
	type Transaction
} from '$lib/domain/transaction';
import { error } from '@sveltejs/kit';

export async function createTransaction(data: CreateTransactionDTO): Promise<Transaction> {
	return await db.transaction(async (tx) => {
		// 1. Get the account to find the current balance
		const [targetAccount] = await tx.select().from(account).where(eq(account.id, data.accountId));

		if (!targetAccount) {
			throw error(404, 'Account not found');
		}

		// For transfers, validate that both accounts have the same currency
		if (data.type === 'transfer') {
			if (!data.toAccountId) {
				throw error(400, 'Transfer requires a destination account');
			}

			const [toAccount] = await tx.select().from(account).where(eq(account.id, data.toAccountId));

			if (!toAccount) {
				throw error(404, 'Destination account not found');
			}

			if (!validateTransferAccounts(targetAccount.currencyCode, toAccount.currencyCode)) {
				throw error(400, 'Cannot transfer between accounts with different currencies');
			}

			// Update destination account balance
			const newToBalance = toAccount.currentBalance + data.amount;
			await tx
				.update(account)
				.set({ currentBalance: newToBalance, updatedAt: new Date() })
				.where(eq(account.id, data.toAccountId));
		}

		// 2. Calculate the new balance for the source account
		const newBalance = calculateNewBalance(targetAccount.currentBalance, data.amount, data.type);

		// 3. Update the account balance
		await tx
			.update(account)
			.set({ currentBalance: newBalance, updatedAt: new Date() })
			.where(eq(account.id, data.accountId));

		// 4. Create the transaction
		const [newTransaction] = await tx.insert(transaction).values(data).returning();

		return newTransaction;
	});
}
