import { createUser } from '$lib/application/user/create-user';
import { updateUser } from '$lib/application/user/update-user';
import { listUsers } from '$lib/application/user/list-users';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const users = await listUsers();
	return { users };
};

export const actions: Actions = {
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
