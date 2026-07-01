<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { untrack } from 'svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Check, Circle, LoaderCircle, Plus, Trash2 } from '@lucide/svelte';

	type SerializedTodoItem = {
		id: string;
		userId: string;
		title: string;
		completed: boolean;
		sortOrder: number;
		createdAt: string;
		updatedAt: string;
	};

	type TodoDraft = SerializedTodoItem & {
		isDirty?: boolean;
	};

	const queryClient = useQueryClient();
	const todosQuery = createQuery<SerializedTodoItem[]>(() => ({
		queryKey: ['todos'],
		queryFn: async () => {
			const response = await fetch('/api/todos');
			if (!response.ok) throw new Error('Failed to load todo list');
			return response.json();
		}
	}));

	let todos = $state<TodoDraft[]>([]);
	let newTitle = $state('');
	let creating = $state(false);
	let saveError = $state<string | null>(null);
	let savingIds = $state(new Set<string>());
	let deletingIds = $state(new Set<string>());
	const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

	let hasBackgroundWork = $derived(creating || savingIds.size > 0 || deletingIds.size > 0);
	let remainingCount = $derived(todos.filter((todo) => !todo.completed).length);

	$effect(() => {
		const serverTodos = todosQuery.data;
		if (!serverTodos) return;

		const localById = new Map(untrack(() => todos).map((todo) => [todo.id, todo]));
		todos = serverTodos.map((todo) => {
			const local = localById.get(todo.id);
			if (local && (local.isDirty || savingIds.has(todo.id))) return local;
			return { ...todo };
		});
	});

	function setSaving(id: string, saving: boolean) {
		const next = new Set(savingIds);
		if (saving) next.add(id);
		else next.delete(id);
		savingIds = next;
	}

	function setDeleting(id: string, deleting: boolean) {
		const next = new Set(deletingIds);
		if (deleting) next.add(id);
		else next.delete(id);
		deletingIds = next;
	}

	function updateLocal(id: string, patch: Partial<TodoDraft>) {
		todos = todos.map((todo) => (todo.id === id ? { ...todo, ...patch } : todo));
	}

	async function patchTodo(id: string, patch: { title?: string; completed?: boolean }) {
		setSaving(id, true);
		saveError = null;

		try {
			const response = await fetch(`/api/todos/${id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(patch)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? 'Failed to save todo');
			}

			const saved = (await response.json()) as SerializedTodoItem;
			updateLocal(id, { ...saved, isDirty: false });
			queryClient.setQueryData<SerializedTodoItem[]>(['todos'], (old) =>
				(old ?? []).map((todo) => (todo.id === id ? saved : todo))
			);
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to save todo';
		} finally {
			setSaving(id, false);
		}
	}

	function scheduleTitleSave(id: string, title: string) {
		updateLocal(id, { title, isDirty: true });
		const existing = saveTimers.get(id);
		if (existing) clearTimeout(existing);

		saveTimers.set(
			id,
			setTimeout(() => {
				saveTimers.delete(id);
				void patchTodo(id, { title });
			}, 500)
		);
	}

	async function addTodo() {
		const title = newTitle.trim();
		if (!title || creating) return;

		creating = true;
		saveError = null;

		try {
			const response = await fetch('/api/todos', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? 'Failed to add todo');
			}

			const created = (await response.json()) as SerializedTodoItem;
			newTitle = '';
			todos = [...todos, { ...created }];
			queryClient.setQueryData<SerializedTodoItem[]>(['todos'], (old) => [...(old ?? []), created]);
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to add todo';
		} finally {
			creating = false;
		}
	}

	async function toggleTodo(todo: TodoDraft) {
		const completed = !todo.completed;
		updateLocal(todo.id, { completed });
		await patchTodo(todo.id, { completed });
	}

	async function deleteTodo(id: string) {
		setDeleting(id, true);
		saveError = null;

		try {
			const response = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? 'Failed to delete todo');
			}

			todos = todos.filter((todo) => todo.id !== id);
			queryClient.setQueryData<SerializedTodoItem[]>(['todos'], (old) =>
				(old ?? []).filter((todo) => todo.id !== id)
			);
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to delete todo';
		} finally {
			setDeleting(id, false);
		}
	}
</script>

<Card.Root>
	<Card.Header class="flex flex-row items-center justify-between gap-3">
		<div>
			<Card.Title>Peace of Mind</Card.Title>
			<Card.Description>
				{remainingCount}
				{remainingCount === 1 ? 'thing' : 'things'} left to handle.
			</Card.Description>
		</div>
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			{#if hasBackgroundWork}
				<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
				<span>Saving</span>
			{:else}
				<Check class="h-3.5 w-3.5 text-income" />
				<span>Saved</span>
			{/if}
		</div>
	</Card.Header>

	<Card.Content class="space-y-4">
		<form
			class="flex gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				void addTodo();
			}}
		>
			<Input bind:value={newTitle} placeholder="Add something to remember..." disabled={creating} />
			<Button type="submit" size="icon" disabled={!newTitle.trim() || creating}>
				{#if creating}
					<LoaderCircle class="h-4 w-4 animate-spin" />
				{:else}
					<Plus class="h-4 w-4" />
				{/if}
			</Button>
		</form>

		{#if todosQuery.isPending && todos.length === 0}
			<div class="space-y-3">
				<Skeleton class="h-9 w-full" />
				<Skeleton class="h-9 w-full" />
				<Skeleton class="h-9 w-4/5" />
			</div>
		{:else if todosQuery.isError}
			<div
				class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
			>
				Failed to load your list. Try refreshing the page.
			</div>
		{:else if todos.length === 0}
			<div class="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center">
				<Circle class="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
				<p class="text-sm font-medium">Nothing on your mind yet.</p>
				<p class="text-xs text-muted-foreground">Add a task, note, reminder, or loose end.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each todos as todo (todo.id)}
					<div class="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
						<Button
							variant="ghost"
							size="icon"
							class="h-7 w-7 shrink-0"
							disabled={savingIds.has(todo.id) || deletingIds.has(todo.id)}
							onclick={() => void toggleTodo(todo)}
						>
							{#if todo.completed}
								<Check class="h-4 w-4 text-income" />
							{:else}
								<Circle class="h-4 w-4 text-muted-foreground" />
							{/if}
						</Button>

						<Input
							value={todo.title}
							class={`h-8 border-transparent bg-transparent px-1 shadow-none ${todo.completed ? 'text-muted-foreground line-through' : ''}`}
							disabled={deletingIds.has(todo.id)}
							oninput={(event) => scheduleTitleSave(todo.id, event.currentTarget.value)}
						/>

						<div class="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground">
							{#if savingIds.has(todo.id)}
								<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
							{:else if todo.isDirty}
								<span class="h-1.5 w-1.5 rounded-full bg-savings"></span>
							{/if}
						</div>

						<Button
							variant="ghost"
							size="icon"
							class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
							disabled={deletingIds.has(todo.id)}
							onclick={() => void deleteTodo(todo.id)}
						>
							{#if deletingIds.has(todo.id)}
								<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
							{:else}
								<Trash2 class="h-3.5 w-3.5" />
							{/if}
						</Button>
					</div>
				{/each}
			</div>
		{/if}

		{#if saveError}
			<p class="text-xs text-destructive">{saveError}</p>
		{/if}
	</Card.Content>
</Card.Root>
