import { db } from '$lib/infra/db';
import { account, transaction } from '$lib/infra/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { CreateTransferDTO } from '$lib/domain/transaction';

export async function createTransfer(data: CreateTransferDTO) {
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

		// 2. Validate same currency
		if (fromAccount.currencyCode !== toAccount.currencyCode) {
			throw error(400, 'Accounts must have the same currency for transfers');
		}

		// 3. Update balances
		const newFromBalance = fromAccount.currentBalance - data.amount;
		const newToBalance = toAccount.currentBalance + data.amount;

		await tx
			.update(account)
			.set({ currentBalance: newFromBalance, updatedAt: new Date() })
			.where(eq(account.id, data.fromAccountId));

		await tx
			.update(account)
			.set({ currentBalance: newToBalance, updatedAt: new Date() })
			.where(eq(account.id, data.toAccountId));

		// 4. Create transfer transaction records
		// From account perspective (outgoing)
		const [fromTransaction] = await tx
			.insert(transaction)
			.values({
				accountId: data.fromAccountId,
				type: 'transfer',
				amount: data.amount,
				name: data.name,
				description: data.description,
				category: null,
				payee: null,
				toAccountId: data.toAccountId
			})
			.returning();

		// To account perspective (incoming)
		await tx.insert(transaction).values({
			accountId: data.toAccountId,
			type: 'transfer',
			amount: data.amount,
			name: data.name,
			description: data.description,
			category: null,
			payee: null,
			toAccountId: data.fromAccountId // This shows where it came from
		});

		return fromTransaction;
	});
}
