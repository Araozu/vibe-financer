<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
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
		<Card.Root>
			<Card.Header>
				<Card.Title>{selectedUserId ? 'Update User' : 'Create New User'}</Card.Title>
			</Card.Header>
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
				class="flex flex-col gap-6"
			>
				<Card.Content class="space-y-4">
					{#if selectedUserId}
						<input type="hidden" name="id" value={selectedUserId} />
					{/if}

					<div class="space-y-2">
						<label for="age" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
							Age
						</label>
						<input
							type="number"
							name="age"
							id="age"
							bind:value={age}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							placeholder="Enter age"
						/>
					</div>

					{#if form?.error}
						<p class="text-sm font-medium text-destructive">{form.error}</p>
					{/if}
				</Card.Content>
				<Card.Footer class="flex gap-2">
					<Button type="submit">
						{selectedUserId ? 'Update' : 'Create'}
					</Button>
					{#if selectedUserId}
						<Button variant="ghost" type="button" onclick={resetForm}>Cancel</Button>
					{/if}
				</Card.Footer>
			</form>
		</Card.Root>

		<!-- List Section -->
		<section class="space-y-4">
			<h2 class="text-xl font-semibold">Existing Users</h2>
			<div class="space-y-2">
				{#each data.users as user}
					<Card.Root
						class="hover:bg-accent cursor-pointer transition-colors py-0 gap-0"
						onclick={() => selectUser(user)}
						onkeydown={(e) => e.key === 'Enter' && selectUser(user)}
						role="button"
						tabindex={0}
					>
						<Card.Content class="flex items-center justify-between p-4">
							<div>
								<p class="font-mono text-xs text-muted-foreground">{user.id}</p>
								<p class="font-medium">Age: {user.age ?? 'N/A'}</p>
							</div>
							<Button variant="outline" size="sm">Edit</Button>
						</Card.Content>
					</Card.Root>
				{/each}
				{#if data.users.length === 0}
					<Card.Root class="border-dashed">
						<Card.Content class="text-muted-foreground text-center py-8">
							No users found.
						</Card.Content>
					</Card.Root>
				{/if}
			</div>
		</section>
	</div>
</div>
