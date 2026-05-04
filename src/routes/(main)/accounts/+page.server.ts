import { createAccount } from '$lib/application/account/create-account';
import { updateAccount } from '$lib/application/account/update-account';
import { createTransaction } from '$lib/application/transaction/create-transaction';
import { editTransaction } from '$lib/application/transaction/edit-transaction';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { AccountType } from '$lib/domain/account';
import type { TransactionType } from '$lib/domain/transaction';
import { parseExchangeRate } from '$lib/domain/transaction';
import { parseDateLocal } from '$lib/domain/date-formatter';
import { fromZonedTime } from 'date-fns-tz';

export const actions: Actions = {
	// ... (omitting createAccount and updateAccount for brevity)
	createCurrency: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const code = formData.get('code') as string;
		const symbol = formData.get('symbol') as string;
		const name = formData.get('name') as string;

		try {
			const { createCurrency } = await import('$lib/application/currency/create-currency');
			await createCurrency({
				userId: locals.user.id,
				code,
				symbol,
				name
			});
			return { success: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(400, { error: message });
		}
	},
	createAccount: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const type = formData.get('type') as AccountType;
		const initialBalanceStr = formData.get('initialBalance') as string;
		const currencyId = formData.get('currencyId') as string;
		const color = formData.get('color') as string;

		const parsedBalance = parseFloat(initialBalanceStr);
		const initialBalance = isNaN(parsedBalance) ? 0 : Math.round(parsedBalance * 100);

		try {
			await createAccount({
				userId: locals.user.id,
				name,
				description: description || null,
				type,
				initialBalance,
				currentBalance: initialBalance,
				currencyId,
				color
			});
			return { success: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(400, { error: message });
		}
	},
	updateAccount: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const type = formData.get('type') as AccountType;
		const initialBalanceStr = formData.get('initialBalance') as string;
		const currencyId = formData.get('currencyId') as string;
		const color = formData.get('color') as string;

		const parsedBalance = initialBalanceStr ? parseFloat(initialBalanceStr) : undefined;
		const initialBalance =
			parsedBalance !== undefined && !isNaN(parsedBalance)
				? Math.round(parsedBalance * 100)
				: undefined;

		try {
			await updateAccount(
				id,
				{
					name,
					description: description || null,
					type,
					initialBalance,
					currencyId,
					color
				},
				locals.user.id
			);
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
		const budgetIdRaw = formData.get('budgetId');
		const budgetId = budgetIdRaw == null || String(budgetIdRaw) === '' ? null : String(budgetIdRaw);
		const payee = formData.get('payee') as string;
		const toAccountId = formData.get('toAccountId') as string | null;
		const exchangeRateStr = formData.get('exchangeRate') as string | null;
		const dateStr = formData.get('date') as string;

		const parsedAmount = parseFloat(amountStr);
		const amount = isNaN(parsedAmount) ? 0 : Math.round(parsedAmount * 100);

		const exchangeRate = parseExchangeRate(exchangeRateStr);

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
					budgetId,
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
		const budgetIdField = formData.get('budgetId');
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
			budgetId?: string | null;
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
		if (budgetIdField !== null) {
			updates.budgetId = String(budgetIdField) === '' ? null : String(budgetIdField);
		}
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
