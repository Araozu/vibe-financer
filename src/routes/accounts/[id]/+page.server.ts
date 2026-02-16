import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAccountState } from '$lib/application/account/list-accounts';
import { listTransactionsByAccountPaginated } from '$lib/application/transaction/list-transactions';

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
			createdAt: account.createdAt.toISOString(),
			updatedAt: account.updatedAt.toISOString()
		},
		initialTransactions: initialTransactions.map((tx) => ({
			...tx,
			createdAt: tx.createdAt.toISOString(),
			updatedAt: tx.updatedAt.toISOString()
		}))
	};
};
