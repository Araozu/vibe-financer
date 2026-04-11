import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { currencies: [] };
	}

	const currencies = await eventStoreRepo.getAllCurrencies();
	return { currencies };
};

export const actions: Actions = {
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

	updateCurrency: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const code = formData.get('code') as string;
		const symbol = formData.get('symbol') as string;
		const name = formData.get('name') as string;

		try {
			const { updateCurrency } = await import('$lib/application/currency/update-currency');
			await updateCurrency(
				id,
				{ code, symbol, name },
				locals.user.id
			);
			return { success: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(400, { error: message });
		}
	},

	deleteCurrency: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			const { deleteCurrency } = await import('$lib/application/currency/delete-currency');
			await deleteCurrency(id, locals.user.id);
			return { success: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return fail(400, { error: message });
		}
	}
};
