import { deleteTodoItem, updateTodoItem } from '$lib/application/todo/todo-items';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
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
	const patch = {
		...(typeof o.title === 'string' ? { title: o.title } : {}),
		...(typeof o.completed === 'boolean' ? { completed: o.completed } : {}),
		...(typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder)
			? { sortOrder: Math.round(o.sortOrder) }
			: {})
	};

	try {
		const updated = await updateTodoItem(locals.user.id, params.id, patch);
		if (!updated) return json({ error: 'Todo not found' }, { status: 404 });
		return json(updated);
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Failed to update todo';
		return json({ error: message }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const deleted = await deleteTodoItem(locals.user.id, params.id);
	if (!deleted) return json({ error: 'Todo not found' }, { status: 404 });
	return json({ success: true });
};
