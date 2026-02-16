import { budgetRepo } from '$lib/infra/repos/budget.repo';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const budgets = await budgetRepo.getByUser(locals.user.id);
    return json(budgets);
};
