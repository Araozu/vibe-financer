import { createTransaction } from '$lib/application/transaction/create-transaction';
import { editTransaction } from '$lib/application/transaction/edit-transaction';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { TransactionType } from '$lib/domain/transaction';
import { parseExchangeRate } from '$lib/domain/transaction';
import { parseDateLocal } from '$lib/domain/date-formatter';
import { fromZonedTime } from 'date-fns-tz';

export const actions: Actions = {
	// ... (omitting createAccount for brevity)
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
		const exchangeRateStr = formData.get('exchangeRate') as string | null;
		const dateStr = formData.get('date') as string;
		const timeStr = formData.get('time') as string;
		const timezone = formData.get('timezone') as string;

		if (!timeStr) {
			return fail(400, { error: 'Time is required' });
		}

		const amount = Math.round(parseFloat(amountStr) * 100);

		const exchangeRate = parseExchangeRate(exchangeRateStr);

		// Combine date and time in the user's timezone, then convert to UTC Date object
		const localDateTimeStr = `${dateStr}T${timeStr}:00`;
		const createdAt = timezone
			? fromZonedTime(localDateTimeStr, timezone)
			: parseDateLocal(localDateTimeStr);

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
					exchangeRate,
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
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(400, { error: message });
		}
	}
};
