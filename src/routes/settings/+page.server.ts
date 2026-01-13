import { listUsers } from '$lib/application/user/list-users';
import { updateUser } from '$lib/application/user/update-user';
import { createUser } from '$lib/application/user/create-user';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const users = await listUsers();
	// For now, since there's no auth, we'll use the first user or create one
	let user = users[0];
	
	if (!user) {
		// Create a default user if none exists
		user = await createUser({
			name: null,
			email: null,
			age: null,
			defaultCurrencyCode: 'USD',
			defaultCurrencySymbol: '$'
		});
	}
	
	return { user };
};

export const actions: Actions = {
	updateSettings: async ({ request }) => {
		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const ageStr = formData.get('age') as string;
		const defaultCurrencyCode = (formData.get('defaultCurrencyCode') as string)?.trim();
		const defaultCurrencySymbol = (formData.get('defaultCurrencySymbol') as string)?.trim();

		const age = ageStr ? parseInt(ageStr, 10) : null;

		if (!userId) {
			return fail(400, { error: 'User ID is required' });
		}

		if (!defaultCurrencyCode || defaultCurrencyCode.length === 0) {
			return fail(400, { error: 'Currency code is required' });
		}

		if (!defaultCurrencySymbol || defaultCurrencySymbol.length === 0) {
			return fail(400, { error: 'Currency symbol is required' });
		}

		try {
			await updateUser(userId, {
				name: name || null,
				email: email || null,
				age,
				defaultCurrencyCode,
				defaultCurrencySymbol
			});
			return { success: true, message: 'Settings updated successfully!' };
		} catch (error: any) {
			return fail(400, { error: error.message });
		}
	}
};
