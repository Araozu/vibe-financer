import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	return json({
		id: locals.user.id,
		email: locals.user.email,
		firstName: locals.user.firstName,
		lastName: locals.user.lastName,
		phoneNumber: locals.user.phoneNumber,
		dateOfBirth: locals.user.dateOfBirth,
		preferredCurrency: locals.user.preferredCurrency,
		timezone: locals.user.timezone,
		age: locals.user.age,
		defaultAccountId: locals.user.defaultAccountId
	});
};
