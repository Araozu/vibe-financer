import { db } from '$lib/infra/db';
import { account, transaction } from '$lib/infra/db/schema';
import { eq } from 'drizzle-orm';
import {
	calculateNewBalance,
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

		// 2. Calculate the new balance
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
