import { eventStoreRepo } from '$lib/infra/repos/event-store.repo';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const currencies = await eventStoreRepo.getAllCurrencies();
	return json(currencies);
};
