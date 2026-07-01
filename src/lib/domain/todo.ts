export interface TodoItem {
	id: string;
	userId: string;
	title: string;
	completed: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateTodoItemDTO {
	userId: string;
	title: string;
	sortOrder?: number;
}

export interface UpdateTodoItemDTO {
	title?: string;
	completed?: boolean;
	sortOrder?: number;
}

export function normalizeTodoTitle(title: string): string {
	return title.trim().replace(/\s+/g, ' ');
}
