import { db } from '$lib/infra/db';
import { account, transaction } from '$lib/infra/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import {
	validateTransferCurrencies,
	validateTransferAccounts,
	type Transaction
} from '$lib/domain/transaction';

export interface CreateTransferDTO {
	fromAccountId: string;
	toAccountId: string;
	amount: number;
	name: string | null;
	description: string | null;
}

export async function createTransfer(data: CreateTransferDTO): Promise<Transaction> {
	return await db.transaction(async (tx) => {
		// 1. Get both accounts
		const [fromAccount] = await tx
			.select()
			.from(account)
			.where(eq(account.id, data.fromAccountId));
		const [toAccount] = await tx.select().from(account).where(eq(account.id, data.toAccountId));

		if (!fromAccount) {
			throw error(404, 'Source account not found');
		}

		if (!toAccount) {
			throw error(404, 'Destination account not found');
		}

		// 2. Validate accounts are different
		if (!validateTransferAccounts(data.fromAccountId, data.toAccountId)) {
			throw error(400, 'Cannot transfer to the same account');
		}

		// 3. Validate currencies match
		if (!validateTransferCurrencies(fromAccount.currencyCode, toAccount.currencyCode)) {
			throw error(400, 'Cannot transfer between accounts with different currencies');
		}

		// 4. Validate sufficient balance
		if (fromAccount.currentBalance < data.amount) {
			throw error(400, 'Insufficient balance in source account');
		}

		// 5. Calculate new balances
		const newFromBalance = fromAccount.currentBalance - data.amount;
		const newToBalance = toAccount.currentBalance + data.amount;

		// 6. Update both account balances
		await tx
			.update(account)
			.set({ currentBalance: newFromBalance, updatedAt: new Date() })
			.where(eq(account.id, data.fromAccountId));

		await tx
			.update(account)
			.set({ currentBalance: newToBalance, updatedAt: new Date() })
			.where(eq(account.id, data.toAccountId));

		// 7. Create the transfer transaction
		const [newTransaction] = await tx
			.insert(transaction)
			.values({
				accountId: data.fromAccountId,
				type: 'transfer',
				amount: data.amount,
				name: data.name,
				description: data.description,
				category: null,
				payee: null,
				targetAccountId: data.toAccountId
			})
			.returning();

		return newTransaction;
	});
}
