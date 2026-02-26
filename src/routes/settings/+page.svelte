<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { User, Lock, Mail } from '@lucide/svelte';

	let { form } = $props();

	// User data type from API
	interface UserData {
		id: string;
		email: string;
		firstName: string | null;
		lastName: string | null;
		phoneNumber: string | null;
		dateOfBirth: string | null;
		preferredCurrency: string | null;
		timezone: string | null;
		age: number | null;
		defaultAccountId: string | null;
	}

	interface AccountData {
		id: string;
		name: string;
		color: string;
	}

	// Query for user data
	const userQuery = createQuery<UserData>(() => ({
		queryKey: ['user'],
		queryFn: async () => (await fetch('/api/user')).json()
	}));

	// Query for accounts
	const accountsQuery = createQuery<AccountData[]>(() => ({
		queryKey: ['accounts'],
		queryFn: async () => (await fetch('/api/accounts')).json()
	}));

	const queryClient = useQueryClient();

	let user = $derived(userQuery.data);
	let accountsList = $derived(accountsQuery.data ?? []);

	let selectedDefaultAccountId = $state('');

	$effect(() => {
		if (user?.defaultAccountId) {
			selectedDefaultAccountId = user.defaultAccountId;
		}
	});

	let loadingProfile = $state(false);
	let loadingPassword = $state(false);
	let loadingEmail = $state(false);

	// Password form state for resetting
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	// Format date for input (YYYY-MM-DD)
	function formatDateForInput(date: string | null): string {
		if (!date) return '';
		const d = new Date(date);
		return d.toISOString().split('T')[0];
	}

	$effect(() => {
		if (form?.success) {
			toast.success(form.message ?? 'Changes saved successfully');
			// Invalidate user query to refetch updated data
			queryClient.invalidateQueries({ queryKey: ['user'] });
			// Reset password fields on success
			if (form.success && loadingPassword === false) {
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
			}
		} else if (form?.error) {
			toast.error(form.error);
		}
	});
</script>

<!-- Content -->
{#if user}
	<div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
		<!-- Profile Information -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-2">
					<User class="h-5 w-5 text-primary" />
					<Card.Title>Profile Information</Card.Title>
				</div>
				<Card.Description>
					Update your personal information for a better experience
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/updateProfile"
					use:enhance={() => {
						loadingProfile = true;
						return async ({ update }) => {
							await update();
							loadingProfile = false;
						};
					}}
					class="space-y-4"
				>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="firstName">First Name</Label>
							<Input
								id="firstName"
								name="firstName"
								type="text"
								placeholder="John"
								value={user.firstName ?? ''}
								disabled={loadingProfile}
							/>
						</div>

						<div class="space-y-2">
							<Label for="lastName">Last Name</Label>
							<Input
								id="lastName"
								name="lastName"
								type="text"
								placeholder="Doe"
								value={user.lastName ?? ''}
								disabled={loadingProfile}
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="phoneNumber">Phone Number</Label>
						<Input
							id="phoneNumber"
							name="phoneNumber"
							type="tel"
							placeholder="+1 (555) 123-4567"
							value={user.phoneNumber ?? ''}
							disabled={loadingProfile}
						/>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="dateOfBirth">Date of Birth</Label>
							<Input
								id="dateOfBirth"
								name="dateOfBirth"
								type="date"
								value={formatDateForInput(user.dateOfBirth)}
								disabled={loadingProfile}
							/>
						</div>

						<div class="space-y-2">
							<Label for="age">Age</Label>
							<Input
								id="age"
								name="age"
								type="number"
								placeholder="25"
								value={user.age ?? ''}
								disabled={loadingProfile}
								min="0"
								max="150"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="preferredCurrency">Preferred Currency</Label>
							<Input
								id="preferredCurrency"
								name="preferredCurrency"
								type="text"
								placeholder="USD"
								value={user.preferredCurrency ?? 'USD'}
								disabled={loadingProfile}
							/>
						</div>

						<div class="space-y-2">
							<Label for="timezone">Timezone</Label>
							<Input
								id="timezone"
								name="timezone"
								type="text"
								placeholder="UTC"
								value={user.timezone ?? 'UTC'}
								disabled={loadingProfile}
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="defaultAccountId">Default Account</Label>
						<Select.Root type="single" bind:value={selectedDefaultAccountId}>
							<Select.Trigger
								id="defaultAccountId"
								disabled={loadingProfile}
								class="w-full"
							>
								{#if selectedDefaultAccountId}
									{@const selectedAccount = accountsList.find((a) => a.id === selectedDefaultAccountId)}
									{#if selectedAccount}
										<div class="flex items-center gap-2">
											<div class="h-2 w-2 rounded-full" style="background-color: {selectedAccount.color}"></div>
											{selectedAccount.name}
										</div>
									{:else}
										Select an account
									{/if}
								{:else}
									None (use first account)
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="" label="None">None (use first account)</Select.Item>
								{#each accountsList as account (account.id)}
									<Select.Item value={account.id} label={account.name}>
										<div class="flex items-center gap-2">
											<div class="h-2 w-2 rounded-full" style="background-color: {account.color}"></div>
											{account.name}
										</div>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="defaultAccountId" value={selectedDefaultAccountId} />
						<p class="text-xs text-muted-foreground">
							This account will be pre-selected when creating new transactions
						</p>
					</div>

					<div class="flex justify-end pt-2">
						<Button type="submit" disabled={loadingProfile}>
							{loadingProfile ? 'Saving...' : 'Save Changes'}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- Change Email -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-2">
					<Mail class="h-5 w-5 text-primary" />
					<Card.Title>Email Address</Card.Title>
				</div>
				<Card.Description>
					Current email: <span class="font-medium">{user.email}</span>
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/changeEmail"
					use:enhance={() => {
						loadingEmail = true;
						return async ({ update }) => {
							await update();
							loadingEmail = false;
						};
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<Label for="newEmail">New Email Address</Label>
						<Input
							id="newEmail"
							name="newEmail"
							type="email"
							placeholder="newemail@example.com"
							required
							disabled={loadingEmail}
						/>
					</div>

					<div class="flex justify-end">
						<Button type="submit" disabled={loadingEmail}>
							{loadingEmail ? 'Updating...' : 'Update Email'}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- Change Password -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-2">
					<Lock class="h-5 w-5 text-primary" />
					<Card.Title>Change Password</Card.Title>
				</div>
				<Card.Description>Ensure your account is using a strong password</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/changePassword"
					use:enhance={() => {
						loadingPassword = true;
						return async ({ update }) => {
							await update();
							loadingPassword = false;
						};
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<Label for="currentPassword">Current Password</Label>
						<Input
							id="currentPassword"
							name="currentPassword"
							type="password"
							placeholder="••••••••"
							required
							disabled={loadingPassword}
							bind:value={currentPassword}
						/>
					</div>

					<div class="space-y-2">
						<Label for="newPassword">New Password</Label>
						<Input
							id="newPassword"
							name="newPassword"
							type="password"
							placeholder="••••••••"
							required
							disabled={loadingPassword}
							bind:value={newPassword}
						/>
						<p class="text-xs text-muted-foreground">Must be at least 8 characters long</p>
					</div>

					<div class="space-y-2">
						<Label for="confirmPassword">Confirm New Password</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							placeholder="••••••••"
							required
							disabled={loadingPassword}
							bind:value={confirmPassword}
						/>
					</div>

					<div class="flex justify-end">
						<Button type="submit" disabled={loadingPassword}>
							{loadingPassword ? 'Updating...' : 'Update Password'}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div class="mx-auto max-w-5xl px-4 py-8">
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-muted-foreground">Loading user data...</p>
			</Card.Content>
		</Card.Root>
	</div>
{/if}
