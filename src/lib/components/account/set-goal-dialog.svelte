<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { PiggyBank, Target, Calendar, ChevronRight, Loader2, Plus, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils.js';

	const queryClient = useQueryClient();

	let {
		open = $bindable(false),
		accountId,
		accountName = '',
		existingGoal = null
	} = $props<{
		open: boolean;
		accountId: string;
		accountName?: string;
		existingGoal?: {
			id: string;
			name: string;
			targetAmount: number;
			targetDate: string | null;
		} | null;
	}>();

	let goalName = $state('');
	let targetAmount = $state('');
	let targetDate = $state('');
	let isLoading = $state(false);
	let isDeleting = $state(false);

	$effect(() => {
		if (open) {
			goalName = existingGoal?.name ?? 'Savings Goal';
			targetAmount = existingGoal ? (existingGoal.targetAmount / 100).toString() : '';
			targetDate = existingGoal?.targetDate ? existingGoal.targetDate.split('T')[0] : '';
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		isLoading = true;

		try {
			const response = await fetch('/api/goals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					accountId,
					name: goalName,
					targetAmount: Math.round(parseFloat(targetAmount) * 100),
					targetDate: targetDate ? new Date(targetDate).toISOString() : null
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? 'Failed to set goal');
			}

			toast.success(existingGoal ? 'Goal updated successfully' : 'Goal set successfully');
			queryClient.invalidateQueries({ queryKey: ['accounts'] });
			open = false;
		} catch (error) {
			console.error('Error setting goal:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to set goal');
		} finally {
			isLoading = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to remove this goal?')) return;
		isDeleting = true;

		try {
			const response = await fetch(`/api/goals?accountId=${accountId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? 'Failed to remove goal');
			}

			toast.success('Goal removed successfully');
			queryClient.invalidateQueries({ queryKey: ['accounts'] });
			open = false;
		} catch (error) {
			console.error('Error removing goal:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to remove goal');
		} finally {
			isDeleting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="overflow-hidden p-0 shadow-2xl sm:max-w-md">
		<form onsubmit={handleSubmit} class="flex h-full flex-col">
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-3"
			>
				<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<div class="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary">
						<PiggyBank class="h-3 w-3" />
						<span class="font-bold tracking-wider uppercase">Goals</span>
					</div>
					<ChevronRight class="h-3 w-3 opacity-50" />
					<span>{accountName}</span>
				</div>
			</div>

			<!-- Main Content -->
			<div class="space-y-6 px-6 py-8">
				<div class="space-y-2">
					<Label
						for="goalName"
						class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
						>Goal Name</Label
					>
					<Input
						id="goalName"
						placeholder="e.g., New Car Fund"
						bind:value={goalName}
						class="h-10 border-muted bg-muted/20 focus-visible:ring-primary"
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label
							for="targetAmount"
							class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
							>Target Amount</Label
						>
						<div class="relative">
							<span class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
								>$</span
							>
							<Input
								id="targetAmount"
								type="number"
								step="0.01"
								placeholder="0.00"
								bind:value={targetAmount}
								class="h-10 border-muted bg-muted/20 pl-7 focus-visible:ring-primary"
								required
							/>
						</div>
					</div>
					<div class="space-y-2">
						<Label
							for="targetDate"
							class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
							>Target Date (Optional)</Label
						>
						<Input
							id="targetDate"
							type="date"
							bind:value={targetDate}
							class="h-10 border-muted bg-muted/20 focus-visible:ring-primary"
						/>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-border/40 bg-muted/10 px-4 py-3"
			>
				<div>
					{#if existingGoal}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="text-destructive hover:bg-destructive/10 hover:text-destructive"
							onclick={handleDelete}
							disabled={isDeleting}
						>
							{#if isDeleting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<Trash2 class="mr-2 h-4 w-4" />
							{/if}
							Remove
						</Button>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<Button type="submit" size="sm" disabled={isLoading}>
						{#if isLoading}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{:else}
							<Target class="mr-2 h-4 w-4" />
						{/if}
						{existingGoal ? 'Update Goal' : 'Set Goal'}
					</Button>
				</div>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
