import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getAccountState } from '$lib/application/account/list-accounts';
import { listTransactionsByAccountPaginated } from '$lib/application/transaction/list-transactions';
import { editTransaction } from '$lib/application/transaction/edit-transaction';
import type { TransactionType } from '$lib/domain/transaction';
import { parseDateLocal } from '$lib/domain/date-formatter';
import { fromZonedTime } from 'date-fns-tz';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const account = await getAccountState(params.id);

	if (!account || account.userId !== locals.user.id) {
		throw error(404, 'Account not found');
	}

	// Initial 50 transactions
	const initialTransactions = await listTransactionsByAccountPaginated(account.id, 50, 0);

	return {
		account: {
			...account,
			createdAt:
				account.createdAt instanceof Date
					? account.createdAt.toISOString()
					: new Date(account.createdAt).toISOString(),
			updatedAt:
				account.updatedAt instanceof Date
					? account.updatedAt.toISOString()
					: new Date(account.updatedAt).toISOString()
		},
		initialTransactions: initialTransactions.map((tx) => ({
			...tx,
			createdAt:
				tx.createdAt instanceof Date
					? tx.createdAt.toISOString()
					: new Date(tx.createdAt).toISOString(),
			updatedAt:
				tx.updatedAt instanceof Date
					? tx.updatedAt.toISOString()
					: new Date(tx.updatedAt).toISOString()
		}))
	};
};

export const actions: Actions = {
	editTransaction: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const transactionId = formData.get('transactionId') as string | null;
		if (!transactionId) {
			return fail(400, { error: 'Transaction ID is required' });
		}
		const type = formData.get('type') as TransactionType | null;
		const amountStr = formData.get('amount') as string | null;
		const name = formData.get('name') as string | null;
		const description = formData.get('description') as string | null;
		const category = formData.get('category') as string | null;
		const payee = formData.get('payee') as string | null;
		const dateStr = formData.get('date') as string | null;
		const timeStr = formData.get('time') as string | null;
		const timezone = formData.get('timezone') as string | null;
		const accountId = formData.get('accountId') as string | null;

		const updates: {
			accountId?: string;
			type?: TransactionType;
			amount?: number;
			name?: string | null;
			description?: string | null;
			category?: string | null;
			payee?: string | null;
			transactionDate?: Date;
		} = {};

		if (accountId) updates.accountId = accountId;
		if (type) updates.type = type;
		if (amountStr !== null) {
			const parsedAmount = parseFloat(amountStr);
			if (Number.isNaN(parsedAmount)) {
				return fail(400, { error: 'Invalid amount' });
			}
			updates.amount = Math.round(parsedAmount * 100);
		}
		if (name !== null) updates.name = name || null;
		if (description !== null) updates.description = description || null;
		if (category !== null) updates.category = category || null;
		if (payee !== null) updates.payee = payee || null;
		if (dateStr) {
			const timePart = timeStr ?? '00:00';
			const localDateTimeStr = `${dateStr}T${timePart}:00`;
			updates.transactionDate = timezone
				? fromZonedTime(localDateTimeStr, timezone)
				: parseDateLocal(localDateTimeStr);
		}

		try {
			await editTransaction(transactionId, updates, locals.user.id);
			return { success: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			return fail(400, { error: message });
		}
	}
};
