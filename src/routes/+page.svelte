<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import { Button } from '$lib/components/ui/button/index.js';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let selectedUserId = $state<string | null>(null);
	let age = $state<number | null>(null);

	function selectUser(user: { id: string; age: number | null }) {
		selectedUserId = user.id;
		age = user.age;
	}

	function resetForm() {
		selectedUserId = null;
		age = null;
	}
</script>

<div class="p-8 space-y-8">
	<h1 class="text-3xl font-bold">User Management</h1>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<!-- Form Section -->
		<section class="space-y-4 p-6 border rounded-lg bg-card">
			<h2 class="text-xl font-semibold">
				{selectedUserId ? 'Update User' : 'Create New User'}
			</h2>

			<form
				method="POST"
				action={selectedUserId ? '?/update' : '?/create'}
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							resetForm();
						}
					};
				}}
				class="space-y-4"
			>
				{#if selectedUserId}
					<input type="hidden" name="id" value={selectedUserId} />
				{/if}

				<div class="space-y-2">
					<label for="age" class="text-sm font-medium">Age</label>
					<input
						type="number"
						name="age"
						id="age"
						bind:value={age}
						class="w-full p-2 border rounded-md bg-background"
						placeholder="Enter age"
					/>
				</div>

				{#if form?.error}
					<p class="text-sm text-destructive">{form.error}</p>
				{/if}

				<div class="flex gap-2">
					<Button type="submit">
						{selectedUserId ? 'Update' : 'Create'}
					</Button>
					{#if selectedUserId}
						<Button variant="ghost" type="button" onclick={resetForm}>Cancel</Button>
					{/if}
				</div>
			</form>
		</section>

		<!-- List Section -->
		<section class="space-y-4">
			<h2 class="text-xl font-semibold">Existing Users</h2>
			<div class="space-y-2">
				{#each data.users as user}
					<div
						class="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
						onclick={() => selectUser(user)}
						onkeydown={(e) => e.key === 'Enter' && selectUser(user)}
						role="button"
						tabindex="0"
					>
						<div>
							<p class="font-mono text-xs text-muted-foreground">{user.id}</p>
							<p class="font-medium">Age: {user.age ?? 'N/A'}</p>
						</div>
						<Button variant="outline" size="sm">Edit</Button>
					</div>
				{/each}
				{#if data.users.length === 0}
					<p class="text-muted-foreground text-center py-8 border border-dashed rounded-lg">
						No users found.
					</p>
				{/if}
			</div>
		</section>
	</div>
</div>
