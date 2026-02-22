import { createAccount } from '$lib/application/account/create-account';
import { updateAccount } from '$lib/application/account/update-account';
import { createTransaction } from '$lib/application/transaction/create-transaction';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { AccountType } from '$lib/domain/account';
import type { TransactionType } from '$lib/domain/transaction';
import { parseDateLocal } from '$lib/domain/date-formatter';

export const actions: Actions = {
	// ... (omitting createAccount and updateAccount for brevity)
	createTransaction: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const accountId = formData.get('accountId') as string;
		const type = formData.get('type') as TransactionType;
		const amountStr = formData.get('amount') as string;
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const category = formData.get('category') as string;
		const payee = formData.get('payee') as string;
		const toAccountId = formData.get('toAccountId') as string | null;
		const dateStr = formData.get('date') as string;

		const amount = Math.round(parseFloat(amountStr) * 100);
		// If it's a date-only string (YYYY-MM-DD), parse it as local midnight
		const createdAt = dateStr ? parseDateLocal(dateStr) : new Date();

		try {
			await createTransaction(
				{
					accountId,
					type,
					amount,
					name: name ?? null,
					description: description ?? null,
					category: category ?? null,
					payee: payee ?? null,
					toAccountId: toAccountId ?? null,
					createdAt,
					deletedAt: null
				},
				locals.user.id
			);
			return { success: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(400, { error: message });
		}
	}
};
