<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Coins, Plus, Loader2, Globe, Tag, Type, Pencil, Trash2 } from '@lucide/svelte';

	let { data } = $props();

	let currencies = $derived(data.currencies ?? []);

	// Create form state
	let createCode = $state('');
	let createSymbol = $state('');
	let createName = $state('');
	let isCreating = $state(false);

	// Edit form state
	let editOpen = $state(false);
	let editId = $state('');
	let editCode = $state('');
	let editSymbol = $state('');
	let editName = $state('');
	let isEditing = $state(false);

	// Delete state
	let deleteOpen = $state(false);
	let deleteId = $state('');
	let deleteName = $state('');
	let isDeleting = $state(false);

	function resetCreateForm() {
		createCode = '';
		createSymbol = '';
		createName = '';
	}

	function openEdit(currency: { id: string; code: string; symbol: string; name: string }) {
		editId = currency.id;
		editCode = currency.code;
		editSymbol = currency.symbol;
		editName = currency.name;
		editOpen = true;
	}

	function openDelete(currency: { id: string; name: string }) {
		deleteId = currency.id;
		deleteName = currency.name;
		deleteOpen = true;
	}
</script>

<!-- Header -->
<div class="mb-8 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-bold">Currencies</h1>
		<p class="text-sm text-muted-foreground">Manage the currencies available for your accounts.</p>
	</div>
</div>

<!-- Summary Card -->
<div class="mb-8">
	<Card.Root class="overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg">
		<Card.Content class="p-6">
			<p class="text-sm font-medium opacity-90">Total Currencies</p>
			<p class="mt-2 text-3xl font-bold tracking-tight">{currencies.length}</p>
			<p class="mt-1 text-sm opacity-75">
				{currencies.length === 1 ? '1 currency' : `${currencies.length} currencies`} configured
			</p>
		</Card.Content>
	</Card.Root>
</div>

<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
	<!-- Currency List -->
	<div class="lg:col-span-2">
		{#if currencies.length === 0}
			<Card.Root
				class="flex flex-col items-center justify-center border-dashed p-12 text-center"
			>
				<div class="mb-4 rounded-full bg-muted p-4">
					<Coins class="h-10 w-10 text-muted-foreground/40" />
				</div>
				<Card.Title class="text-xl">No currencies yet</Card.Title>
				<Card.Description class="mx-auto mt-2 max-w-xs">
					Create your first currency to start managing accounts with different monetary systems.
				</Card.Description>
			</Card.Root>
		{:else}
			<Card.Root>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="pl-6">Code</Table.Head>
								<Table.Head>Name</Table.Head>
								<Table.Head>Symbol</Table.Head>
								<Table.Head class="pr-6 text-right">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each currencies as currency (currency.id)}
								<Table.Row class="group">
									<Table.Cell class="pl-6 font-mono text-sm font-bold">
										{currency.code}
									</Table.Cell>
									<Table.Cell class="text-sm">{currency.name}</Table.Cell>
									<Table.Cell class="text-lg font-bold text-primary">
										{currency.symbol}
									</Table.Cell>
									<Table.Cell class="pr-6 text-right">
										<div
											class="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100"
										>
											<Button
												variant="ghost"
												size="sm"
												class="h-8 w-8 p-0"
												onclick={() => openEdit(currency)}
											>
												<Pencil class="h-4 w-4" />
												<span class="sr-only">Edit</span>
											</Button>
											<Button
												variant="ghost"
												size="sm"
												class="h-8 w-8 p-0 text-destructive hover:text-destructive"
												onclick={() => openDelete(currency)}
											>
												<Trash2 class="h-4 w-4" />
												<span class="sr-only">Delete</span>
											</Button>
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>

	<!-- Create Currency Form -->
	<div>
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-lg">
					<Plus class="h-5 w-5" />
					Add Currency
				</Card.Title>
				<Card.Description>Create a new currency for your accounts.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/createCurrency"
					use:enhance={() => {
						isCreating = true;
						return async ({ result }) => {
							isCreating = false;
							if (result.type === 'success') {
								toast.success('Currency created successfully');
								await invalidateAll();
								resetCreateForm();
							} else if (result.type === 'failure') {
								const errorMessage =
									typeof result.data?.error === 'string'
										? result.data.error
										: 'Failed to create currency';
								toast.error(errorMessage);
							}
						};
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<Label
							for="create-code"
							class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
						>
							Currency Code
						</Label>
						<div class="relative">
							<Globe
								class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
							/>
							<Input
								id="create-code"
								name="code"
								placeholder="USD, EUR, GBP..."
								bind:value={createCode}
								class="pl-9 text-xs font-bold uppercase"
								maxlength={3}
								required
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label
							for="create-name"
							class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
						>
							Full Name
						</Label>
						<div class="relative">
							<Type
								class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
							/>
							<Input
								id="create-name"
								name="name"
								placeholder="US Dollar..."
								bind:value={createName}
								class="pl-9 text-xs"
								required
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label
							for="create-symbol"
							class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
						>
							Symbol
						</Label>
						<div class="relative">
							<Tag
								class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
							/>
							<Input
								id="create-symbol"
								name="symbol"
								placeholder="$, €, £..."
								bind:value={createSymbol}
								class="pl-9 text-xs font-bold"
								required
							/>
						</div>
					</div>

					<Button type="submit" class="w-full" disabled={isCreating}>
						{#if isCreating}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{:else}
							<Plus class="mr-2 h-4 w-4" />
						{/if}
						Add Currency
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- Edit Currency Dialog -->
<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit Currency</Dialog.Title>
			<Dialog.Description>Update the currency details below.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/updateCurrency"
			use:enhance={() => {
				isEditing = true;
				return async ({ result }) => {
					isEditing = false;
					if (result.type === 'success') {
						toast.success('Currency updated successfully');
						await invalidateAll();
						editOpen = false;
					} else if (result.type === 'failure') {
						const errorMessage =
							typeof result.data?.error === 'string'
								? result.data.error
								: 'Failed to update currency';
						toast.error(errorMessage);
					}
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={editId} />

			<div class="space-y-2">
				<Label
					for="edit-code"
					class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
				>
					Currency Code
				</Label>
				<div class="relative">
					<Globe
						class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
					/>
					<Input
						id="edit-code"
						name="code"
						bind:value={editCode}
						class="pl-9 text-xs font-bold uppercase"
						maxlength={3}
						required
					/>
				</div>
			</div>

			<div class="space-y-2">
				<Label
					for="edit-name"
					class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
				>
					Full Name
				</Label>
				<div class="relative">
					<Type
						class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
					/>
					<Input id="edit-name" name="name" bind:value={editName} class="pl-9 text-xs" required />
				</div>
			</div>

			<div class="space-y-2">
				<Label
					for="edit-symbol"
					class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
				>
					Symbol
				</Label>
				<div class="relative">
					<Tag
						class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
					/>
					<Input
						id="edit-symbol"
						name="symbol"
						bind:value={editSymbol}
						class="pl-9 text-xs font-bold"
						required
					/>
				</div>
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={isEditing}>
					{#if isEditing}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Save Changes
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Currency Dialog -->
<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete Currency</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to delete <strong>{deleteName}</strong>? This action cannot be undone.
				Accounts using this currency may be affected.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/deleteCurrency"
			use:enhance={() => {
				isDeleting = true;
				return async ({ result }) => {
					isDeleting = false;
					if (result.type === 'success') {
						toast.success('Currency deleted successfully');
						await invalidateAll();
						deleteOpen = false;
					} else if (result.type === 'failure') {
						const errorMessage =
							typeof result.data?.error === 'string'
								? result.data.error
								: 'Failed to delete currency';
						toast.error(errorMessage);
					}
				};
			}}
		>
			<input type="hidden" name="id" value={deleteId} />
			<div class="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onclick={() => (deleteOpen = false)}>
					Cancel
				</Button>
				<Button type="submit" variant="destructive" disabled={isDeleting}>
					{#if isDeleting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Delete
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
