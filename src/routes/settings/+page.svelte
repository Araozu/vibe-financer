<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { ChevronLeft, Settings, User, Mail, Calendar, DollarSign, Save } from "@lucide/svelte";
	import { enhance } from '$app/forms';
	import { toast } from "svelte-sonner";

	let { data, form } = $props();

	let name = $state(data.user.name || '');
	let email = $state(data.user.email || '');
	let age = $state(data.user.age?.toString() || '');
	let defaultCurrencyCode = $state(data.user.defaultCurrencyCode);
	let defaultCurrencySymbol = $state(data.user.defaultCurrencySymbol);

	function handleCurrencyCodeInput(event: Event) {
		const target = event.target;
		if (target instanceof HTMLInputElement) {
			defaultCurrencyCode = target.value.toUpperCase();
		}
	}

	$effect(() => {
		if (form?.success) {
			toast.success(form.message || 'Settings updated!');
		} else if (form?.error) {
			toast.error(form.error);
		}
	});
</script>

<div class="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
	<!-- Header -->
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
		<div class="flex items-center gap-4">
			<a href="/" class="p-2 hover:bg-muted rounded-full transition-colors">
				<ChevronLeft class="h-5 w-5" />
			</a>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">User Settings</h1>
				<p class="text-muted-foreground">Manage your profile and preferences.</p>
			</div>
		</div>
	</div>

	<!-- Settings Form -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-3">
				<div class="p-2 bg-primary/10 rounded-lg">
					<Settings class="h-5 w-5 text-primary" />
				</div>
				<div>
					<Card.Title>Profile Information</Card.Title>
					<Card.Description>Update your personal details and preferences</Card.Description>
				</div>
			</div>
		</Card.Header>
		<Card.Content>
			<form 
				method="POST" 
				action="?/updateSettings" 
				use:enhance
				class="space-y-6"
			>
				<input type="hidden" name="userId" value={data.user.id} />
				
				<!-- Personal Information Section -->
				<div class="space-y-4">
					<h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
						<User class="h-4 w-4" />
						Personal Information
					</h3>
					
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="name" class="text-sm font-medium">
								Full Name
							</Label>
							<Input 
								id="name" 
								name="name" 
								placeholder="Enter your name" 
								bind:value={name}
								class="w-full"
							/>
						</div>

						<div class="space-y-2">
							<Label for="email" class="text-sm font-medium flex items-center gap-2">
								<Mail class="h-4 w-4" />
								Email Address
							</Label>
							<Input 
								id="email" 
								name="email" 
								type="email"
								placeholder="your.email@example.com" 
								bind:value={email}
								class="w-full"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="age" class="text-sm font-medium flex items-center gap-2">
							<Calendar class="h-4 w-4" />
							Age
						</Label>
						<Input 
							id="age" 
							name="age" 
							type="number"
							placeholder="Enter your age (optional)" 
							bind:value={age}
							class="w-full md:w-64"
							min="0"
							max="150"
						/>
					</div>
				</div>

				<!-- Currency Preferences Section -->
				<div class="space-y-4 pt-6 border-t">
					<h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
						<DollarSign class="h-4 w-4" />
						Currency Preferences
					</h3>
					
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="defaultCurrencyCode" class="text-sm font-medium">
								Default Currency Code
							</Label>
							<Input 
								id="defaultCurrencyCode" 
								name="defaultCurrencyCode" 
								placeholder="USD" 
								bind:value={defaultCurrencyCode}
								on:input={handleCurrencyCodeInput}
								class="w-full uppercase"
								maxlength="3"
								required
							/>
							<p class="text-xs text-muted-foreground">
								3-letter currency code (e.g., USD, EUR, GBP)
							</p>
						</div>

						<div class="space-y-2">
							<Label for="defaultCurrencySymbol" class="text-sm font-medium">
								Currency Symbol
							</Label>
							<Input 
								id="defaultCurrencySymbol" 
								name="defaultCurrencySymbol" 
								placeholder="$" 
								bind:value={defaultCurrencySymbol}
								class="w-full"
								maxlength="3"
								required
							/>
							<p class="text-xs text-muted-foreground">
								Symbol for your currency (e.g., $, €, £)
							</p>
						</div>
					</div>
				</div>

				<!-- Preview Section -->
				<div class="pt-6 border-t">
					<div class="bg-muted/50 rounded-lg p-4 space-y-2">
						<p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>
						<div class="text-lg font-semibold">
							{name || 'Your Name'} 
							{#if age}
								<span class="text-muted-foreground text-sm font-normal">({age} years old)</span>
							{/if}
						</div>
						{#if email}
							<p class="text-sm text-muted-foreground">{email}</p>
						{/if}
						<p class="text-sm">
							Default Currency: <span class="font-mono font-semibold">{defaultCurrencyCode}</span> ({defaultCurrencySymbol})
						</p>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex justify-end pt-4">
					<Button type="submit" size="lg">
						<Save class="mr-2 h-4 w-4" />
						Save Changes
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- Additional Info Card -->
	<Card.Root class="bg-muted/30 border-dashed">
		<Card.Header>
			<Card.Title class="text-base">About Authentication</Card.Title>
		</Card.Header>
		<Card.Content>
			<p class="text-sm text-muted-foreground">
				Currently, this application doesn't have authentication. The system uses the first available user profile.
				In a production environment, you would have your own secure account with authentication.
			</p>
		</Card.Content>
	</Card.Root>
</div>
