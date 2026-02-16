import { createAccount } from '$lib/application/account/create-account';
import { createTransaction } from '$lib/application/transaction/create-transaction';
import { editTransaction } from '$lib/application/transaction/edit-transaction';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { AccountType } from '$lib/domain/account';
import type { TransactionType } from '$lib/domain/transaction';
import { parseDateAsUTC, toUTC } from '$lib/domain/date-formatter';

export const actions: Actions = {
	createAccount: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const type = formData.get('type') as AccountType;
		const initialBalanceStr = formData.get('initialBalance') as string;
		const currencyCode = formData.get('currencyCode') as string;
		const currencySymbol = formData.get('currencySymbol') as string;
		const color = formData.get('color') as string;

		const parsedBalance = parseFloat(initialBalanceStr);
		const initialBalance = isNaN(parsedBalance) ? 0 : Math.round(parsedBalance * 100);

		try {
			await createAccount({
				userId: locals.user.id,
				name,
				description: description ?? null,
				type,
				initialBalance,
				currentBalance: initialBalance,
				currencyCode,
				currencySymbol,
				color
			});
			return { success: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(400, { error: message });
		}
	},
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
		const createdAt = dateStr ? parseDateAsUTC(dateStr) : toUTC(new Date());

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
	},
	editTransaction: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const transactionId = formData.get('transactionId') as string;
		const type = formData.get('type') as TransactionType | null;
		const amountStr = formData.get('amount') as string | null;
		const name = formData.get('name') as string | null;
		const description = formData.get('description') as string | null;
		const category = formData.get('category') as string | null;
		const payee = formData.get('payee') as string | null;
		const dateStr = formData.get('date') as string | null;

		const updates: {
			type?: TransactionType;
			amount?: number;
			name?: string | null;
			description?: string | null;
			category?: string | null;
			payee?: string | null;
			transactionDate?: Date;
		} = {};

		if (type) updates.type = type;
		if (amountStr) updates.amount = Math.round(parseFloat(amountStr) * 100);
		if (name !== null) updates.name = name || null;
		if (description !== null) updates.description = description || null;
		if (category !== null) updates.category = category || null;
		if (payee !== null) updates.payee = payee || null;
		if (dateStr) updates.transactionDate = parseDateAsUTC(dateStr);

		try {
			await editTransaction(transactionId, updates, locals.user.id);
			return { success: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(400, { error: message });
		}
	}
};
