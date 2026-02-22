<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Plus, Trash2, PiggyBank, Globe } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { Progress } from '$lib/components/ui/progress/index.js';

	const queryClient = useQueryClient();

	const budgetsQuery = createQuery(() => ({
		queryKey: ['budgets'],
		queryFn: async () => (await fetch('/api/budgets')).json()
	}));

	let budgets = $derived(budgetsQuery.data ?? []);

	let isSubmitting = $state(false);

	const periods = [
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'yearly', label: 'Yearly' }
	];

	const currenciesQuery = createQuery(() => ({
		queryKey: ['currencies'],
		queryFn: async () => {
			const res = await fetch('/api/currencies');
			return res.json();
		}
	}));

	let currencies = $derived(currenciesQuery.data ?? []);

	let selectedPeriod = $state('monthly');
	let currencyId = $state('');

	$effect(() => {
		if (currencies.length > 0 && !currencyId) {
			currencyId = currencies[0].id;
		}
	});
</script>

<div class="container mx-auto py-8">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Manage Budgets</h1>
			<p class="text-muted-foreground">Set spending limits for your categories</p>
		</div>
		<a href="/">
			<Button variant="outline">Back to Dashboard</Button>
		</a>
	</div>

	<div class="grid gap-8 lg:grid-cols-3">
		<!-- Create Budget Form -->
		<Card.Root class="lg:col-span-1">
			<Card.Header>
				<Card.Title>Create New Budget</Card.Title>
				<Card.Description>Add a new spending limit</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ result }) => {
							isSubmitting = false;
							if (result.type === 'success') {
								queryClient.invalidateQueries({ queryKey: ['budgets'] });
							}
						};
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<Label for="category">Category Name</Label>
						<Input id="category" name="category" placeholder="e.g. Groceries, Rent" required />
					</div>

					<div class="space-y-2">
						<Label for="limit">Monthly Limit</Label>
						<div class="relative">
							<span class="absolute left-3 top-2.5 text-muted-foreground">$</span>
							<Input
								id="limit"
								name="limit"
								type="number"
								step="0.01"
								placeholder="0.00"
								class="pl-7"
								required
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="period">Period</Label>
						<Select.Root type="single" bind:value={selectedPeriod} name="period">
							<Select.Trigger>
								{periods.find((p) => p.value === selectedPeriod)?.label ?? 'Select period'}
							</Select.Trigger>
							<Select.Content>
								{#each periods as period}
									<Select.Item value={period.value}>{period.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-2">
						<Label for="currencyId">Currency</Label>
						<Select.Root type="single" bind:value={currencyId}>
							<Select.Trigger class="w-full">
								<div class="flex items-center gap-2">
									<Globe class="h-4 w-4 text-muted-foreground" />
									<span>{currencies.find((c: any) => c.id === currencyId)?.code ?? 'Select currency'}</span>
								</div>
							</Select.Trigger>
							<Select.Content>
								{#each currencies as currency}
									<Select.Item value={currency.id} label={currency.code}>
										{currency.code} - {currency.name}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="currencyId" value={currencyId} />
					</div>

					<div class="space-y-2">
						<Label for="startDate">Start Date</Label>
						<Input id="startDate" name="startDate" type="date" required value={new Date().toISOString().split('T')[0]} />
					</div>

					<Button type="submit" class="w-full" disabled={isSubmitting}>
						{#if isSubmitting}
							Creating...
						{:else}
							<Plus class="mr-2 h-4 w-4" />
							Create Budget
						{/if}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- Budget List -->
		<div class="lg:col-span-2 space-y-4">
			{#if budgetsQuery.isLoading}
				<div class="flex justify-center py-12">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
				</div>
			{:else}
				{#each budgets as budget}
					<Card.Root>
						<Card.Content class="pt-6">
							<div class="flex items-center justify-between mb-4">
								<div class="flex items-center gap-3">
									<div class="rounded-full bg-primary/10 p-2 text-primary">
										<PiggyBank class="h-5 w-5" />
									</div>
									<div>
										<h3 class="font-semibold text-lg">{budget.category}</h3>
										<p class="text-xs text-muted-foreground capitalize">{budget.period} limit</p>
									</div>
								</div>
								<div class="text-right">
									<div class="text-sm font-medium">
										{budget.currencySymbol ?? '$'}{(budget.currentSpent / 100).toFixed(2)} / <span class="text-lg font-bold">{budget.currencySymbol ?? '$'}{(budget.limit / 100).toFixed(2)}</span>
									</div>
								</div>
							</div>
							
							<div class="space-y-2">
								<Progress value={Math.min((budget.currentSpent / budget.limit) * 100, 100)} class="h-3" />
								<div class="flex justify-between text-xs text-muted-foreground">
									<span>{Math.round((budget.currentSpent / budget.limit) * 100)}% spent</span>
									{#if budget.currentSpent > budget.limit}
										<span class="text-rose-500 font-medium">Over budget by {budget.currencySymbol ?? '$'}{((budget.currentSpent - budget.limit) / 100).toFixed(2)}</span>
									{:else}
										<span>{budget.currencySymbol ?? '$'}{((budget.limit - budget.currentSpent) / 100).toFixed(2)} remaining</span>
									{/if}
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{:else}
					<Card.Root class="border-dashed">
						<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
							<PiggyBank class="h-12 w-12 text-muted-foreground mb-4" />
							<h3 class="text-lg font-semibold">No budgets found</h3>
							<p class="text-muted-foreground max-w-xs">Create your first budget to start tracking your spending by category.</p>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
		</div>
	</div>
</div>
