import { createBudget } from '$lib/application/budget/create-budget';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { parseDateAsUTC } from '$lib/domain/date-formatter';

export const actions: Actions = {
    create: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { error: 'Unauthorized' });
        }

        const formData = await request.formData();
        const category = formData.get('category') as string;
        const limitStr = formData.get('limit') as string;
        const currencyCode = formData.get('currencyCode') as string || 'USD';
        const period = formData.get('period') as 'monthly' | 'weekly' | 'yearly';
        const startDateStr = formData.get('startDate') as string;

        const limit = Math.round(parseFloat(limitStr) * 100);
        const startDate = startDateStr ? parseDateAsUTC(startDateStr) : new Date();

        try {
            await createBudget({
                userId: locals.user.id,
                category,
                limit,
                currencyCode,
                period,
                startDate
            });
            return { success: true };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return fail(400, { error: message });
        }
    }
};
