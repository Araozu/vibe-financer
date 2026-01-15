<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import logo from "$lib/assets/plain_icon.svg";
	import { enhance } from "$app/forms";
	
	let { form } = $props();
	let isSignup = $state(false);
	let loading = $state(false);
</script>

<div class="min-h-screen flex items-center justify-center bg-background p-4">
	<div class="w-full max-w-md">
		<!-- Logo and Header -->
		<div class="flex flex-col items-center mb-8">
			<img src={logo} alt="Vibe Financer" class="h-16 w-16 mb-4" />
			<h1 class="text-3xl font-bold tracking-tight">Vibe Financer</h1>
			<p class="text-muted-foreground mt-2">
				{isSignup ? 'Create your account' : 'Welcome back'}
			</p>
		</div>

		<!-- Auth Card -->
		<Card.Root>
			<Card.Header>
				<Card.Title>{isSignup ? 'Sign Up' : 'Sign In'}</Card.Title>
				<Card.Description>
					{isSignup 
						? 'Enter your details to create a new account' 
						: 'Enter your credentials to access your dashboard'}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if form?.error}
					<div class="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
						<p class="text-sm text-destructive">{form.error}</p>
					</div>
				{/if}

				<form 
					method="POST" 
					action="?/{isSignup ? 'signup' : 'login'}"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input 
							id="email" 
							name="email" 
							type="email" 
							placeholder="name@example.com"
							required 
							disabled={loading}
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">Password</Label>
						<Input 
							id="password" 
							name="password" 
							type="password" 
							placeholder="••••••••"
							required 
							disabled={loading}
						/>
					</div>

					{#if isSignup}
						<div class="space-y-2">
							<Label for="confirmPassword">Confirm Password</Label>
							<Input 
								id="confirmPassword" 
								name="confirmPassword" 
								type="password" 
								placeholder="••••••••"
								required 
								disabled={loading}
							/>
						</div>
					{/if}

					<Button type="submit" class="w-full" disabled={loading}>
						{#if loading}
							Processing...
						{:else}
							{isSignup ? 'Create Account' : 'Sign In'}
						{/if}
					</Button>
				</form>
			</Card.Content>
			<Card.Footer class="flex flex-col space-y-2">
				<div class="text-sm text-center text-muted-foreground">
					{isSignup ? 'Already have an account?' : "Don't have an account?"}
					<button 
						type="button"
						onclick={() => { isSignup = !isSignup; }}
						class="text-primary hover:underline ml-1 font-medium"
						disabled={loading}
					>
						{isSignup ? 'Sign in' : 'Sign up'}
					</button>
				</div>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
