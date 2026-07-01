import { normalizeTodoTitle, type UpdateTodoItemDTO } from '$lib/domain/todo';
import { todoRepo } from '$lib/infra/repos/todo.repo';

export async function listTodoItems(userId: string) {
	return todoRepo.getByUser(userId);
}

export async function createTodoItem(userId: string, title: string) {
	const normalizedTitle = normalizeTodoTitle(title);
	if (!normalizedTitle) throw new Error('Todo title is required');

	const sortOrder = await todoRepo.getNextSortOrder(userId);
	return todoRepo.create({ userId, title: normalizedTitle, sortOrder });
}

export async function updateTodoItem(userId: string, id: string, data: UpdateTodoItemDTO) {
	const patch: UpdateTodoItemDTO = {};

	if (data.title !== undefined) {
		const normalizedTitle = normalizeTodoTitle(data.title);
		if (!normalizedTitle) throw new Error('Todo title is required');
		patch.title = normalizedTitle;
	}

	if (data.completed !== undefined) patch.completed = data.completed;
	if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;

	if (Object.keys(patch).length === 0) throw new Error('No changes provided');

	return todoRepo.update(userId, id, patch);
}

export async function deleteTodoItem(userId: string, id: string) {
	return todoRepo.delete(userId, id);
}
