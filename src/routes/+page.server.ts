import { createUser } from '$lib/application/user/create-user';
import { updateUser } from '$lib/application/user/update-user';
import { listUsers } from '$lib/application/user/list-users';
import { createAccount } from '$lib/application/account/create-account';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { AccountType } from '$lib/domain/account';

export const load: PageServerLoad = async () => {
	const users = await listUsers();
	return { users };
};

export const actions: Actions = {
	createAccount: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const type = formData.get('type') as AccountType;
		const initialBalanceStr = formData.get('initialBalance') as string;
		const currencyCode = formData.get('currencyCode') as string;
		const currencySymbol = formData.get('currencySymbol') as string;
		const color = formData.get('color') as string;

		const initialBalance = parseFloat(initialBalanceStr) * 100; // Convert to cents

		try {
			await createAccount({
				name,
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
	create: async ({ request }) => {
		const formData = await request.formData();
		const ageStr = formData.get('age') as string;
		const age = ageStr ? parseInt(ageStr, 10) : null;

		try {
			await createUser({ age });
			return { success: true };
		} catch (error: any) {
			return fail(400, { error: error.message });
		}
	},
	update: async ({ request }) => {
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
