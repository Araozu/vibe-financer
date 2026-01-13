import { listAccounts } from '$lib/application/account/list-accounts';
import { createAccount } from '$lib/application/account/create-account';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { AccountType } from '$lib/domain/account';

export const load: PageServerLoad = async () => {
	const accounts = await listAccounts();
	return { accounts };
};

export const actions: Actions = {
	createAccount: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const type = formData.get('type') as AccountType;
		const initialBalanceStr = formData.get('initialBalance') as string;
		const currencyCode = formData.get('currencyCode') as string;
		const currencySymbol = formData.get('currencySymbol') as string;
		const color = formData.get('color') as string;

		const initialBalance = Math.round(parseFloat(initialBalanceStr) * 100); // Convert to cents and avoid floating point issues

		try {
			await createAccount({
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
	}
};
