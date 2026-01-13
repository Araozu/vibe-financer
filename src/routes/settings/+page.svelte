<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";
	import { User, Lock, Mail, ArrowLeft } from "@lucide/svelte";
	import logo from "$lib/assets/plain_icon.svg";

	let { data, form } = $props();
	let loadingProfile = $state(false);
	let loadingPassword = $state(false);
	let loadingEmail = $state(false);
	
	// Password form state for resetting
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	// Format date for input (YYYY-MM-DD)
	function formatDateForInput(date: Date | null): string {
		if (!date) return '';
		const d = new Date(date);
		return d.toISOString().split('T')[0];
	}

	$effect(() => {
		if (form?.success) {
			toast.success(form.message || 'Changes saved successfully');
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

<div class="min-h-screen bg-background">
	<!-- Header -->
	<div class="border-b bg-card">
		<div class="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
			<div class="flex items-center gap-4">
				<a href="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
					<ArrowLeft class="h-5 w-5" />
					<span class="text-sm">Back to Dashboard</span>
				</a>
			</div>
			<div class="flex items-center gap-3">
				<img src={logo} alt="Vibe Financer" class="h-8 w-8" />
				<h1 class="text-xl font-bold">Settings</h1>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
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
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="firstName">First Name</Label>
							<Input
								id="firstName"
								name="firstName"
								type="text"
								placeholder="John"
								value={data.user.firstName || ''}
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
								value={data.user.lastName || ''}
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
							value={data.user.phoneNumber || ''}
							disabled={loadingProfile}
						/>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="dateOfBirth">Date of Birth</Label>
							<Input
								id="dateOfBirth"
								name="dateOfBirth"
								type="date"
								value={formatDateForInput(data.user.dateOfBirth)}
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
								value={data.user.age || ''}
								disabled={loadingProfile}
								min="0"
								max="150"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="preferredCurrency">Preferred Currency</Label>
							<Input
								id="preferredCurrency"
								name="preferredCurrency"
								type="text"
								placeholder="USD"
								value={data.user.preferredCurrency || 'USD'}
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
								value={data.user.timezone || 'UTC'}
								disabled={loadingProfile}
							/>
						</div>
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
					Current email: <span class="font-medium">{data.user.email}</span>
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
				<Card.Description>
					Ensure your account is using a strong password
				</Card.Description>
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
						<p class="text-xs text-muted-foreground">
							Must be at least 8 characters long
						</p>
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
</div>
