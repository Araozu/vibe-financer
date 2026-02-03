import { userRepo } from '$lib/infra/repos/user.repo';
import { sessionRepo } from '$lib/infra/repos/session.repo';
import { hashPassword, isValidEmail, validatePassword } from '$lib/domain/auth';

export interface SignupInput {
	email: string;
	password: string;
}

export async function signup(input: SignupInput): Promise<{ success: true; userId: string } | { success: false; error: string }> {
	// Validate email
	if (!isValidEmail(input.email)) {
		return { success: false, error: 'Invalid email address' };
	}

	// Validate password
	const passwordError = validatePassword(input.password);
	if (passwordError) {
		return { success: false, error: passwordError };
	}

	// Only one user allowed
	const userCount = await userRepo.count();
	if (userCount > 0) {
		return { success: false, error: 'Sign-ups are currently disabled' };
	}

	// Check if user already exists
	const existingUser = await userRepo.findByEmail(input.email);
	if (existingUser) {
		return { success: false, error: 'Email already registered' };
	}

	// Create user
	const passwordHash = hashPassword(input.password);
	const user = await userRepo.create({
		email: input.email,
		passwordHash,
		firstName: null,
		lastName: null,
		phoneNumber: null,
		dateOfBirth: null,
		preferredCurrency: null,
		timezone: null,
		age: null
	});

	return { success: true, userId: user.id };
}
