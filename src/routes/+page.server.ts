import { createUser } from '$lib/application/user/create-user';
import { updateUser } from '$lib/application/user/update-user';
import { listUsers } from '$lib/application/user/list-users';
import { listAccounts } from '$lib/application/account/list-accounts';
import { createAccount } from '$lib/application/account/create-account';
import { listTransactions } from '$lib/application/transaction/list-transactions';
import { createTransaction } from '$lib/application/transaction/create-transaction';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { AccountType } from '$lib/domain/account';
import type { TransactionType } from '$lib/domain/transaction';

export const load: PageServerLoad = async ({ locals }) => {
	// Require authentication
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const users = await listUsers();
	const allAccounts = await listAccounts();
	const allTransactions = await listTransactions();
	
	// Filter accounts by user
	const accounts = allAccounts.filter(acc => acc.userId === locals.user!.id);
	
	// Filter transactions by user's accounts
	const accountIds = new Set(accounts.map(acc => acc.id));
	const transactions = allTransactions.filter(tx => accountIds.has(tx.accountId));
	
	return { users, accounts, transactions, currentUser: locals.user };
};

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

		const initialBalance = parseFloat(initialBalanceStr) * 100; // Convert to cents

		try {
			await createAccount({
				userId: locals.user.id,
				name,
				description: description || null,
				type,
				initialBalance,
				currentBalance: initialBalance,
				currencyCode,
				currencySymbol,
				color
			});
			return { success: true };
		} catch (error: any) {
			return fail(400, { error: error.message });
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

		const amount = Math.round(parseFloat(amountStr) * 100);

		try {
			await createTransaction({
				accountId,
				type,
				amount,
				name: name || null,
				description: description || null,
				category: category || null,
				payee: payee || null
			});
			return { success: true };
		} catch (error: any) {
			return fail(400, { error: error.message });
		}
	},
	create: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const ageStr = formData.get('age') as string;
		const age = ageStr ? parseInt(ageStr, 10) : null;

		try {
			await createUser({ email: '', passwordHash: '', age });
			return { success: true };
		} catch (error: any) {
			return fail(400, { error: error.message });
		}
	},
	update: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const ageStr = formData.get('age') as string;
		const age = ageStr ? parseInt(ageStr, 10) : null;

		if (!id) return fail(400, { error: 'User ID is required' });

		try {
			await updateUser(id, { age });
			return { success: true };
		} catch (error: any) {
			return fail(400, { error: error.message });
		}
	}
};
