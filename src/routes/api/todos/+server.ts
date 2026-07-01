import { createTodoItem, listTodoItems } from '$lib/application/todo/todo-items';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	return json(await listTodoItems(locals.user.id));
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (typeof body !== 'object' || body === null) {
		return json({ error: 'Expected JSON object' }, { status: 400 });
	}

	const o = body as Record<string, unknown>;
	const title = typeof o.title === 'string' ? o.title : '';

	try {
		return json(await createTodoItem(locals.user.id, title), { status: 201 });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Failed to create todo';
		return json({ error: message }, { status: 400 });
	}
};
