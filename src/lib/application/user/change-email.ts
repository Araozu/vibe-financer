import { userRepo } from '$lib/infra/repos/user.repo';
import { isValidEmail } from '$lib/domain/auth';

export interface ChangeEmailInput {
	userId: string;
	newEmail: string;
}

export async function changeEmail(input: ChangeEmailInput): Promise<{ success: boolean; error?: string }> {
	// Validate email format
	if (!isValidEmail(input.newEmail)) {
		return { success: false, error: 'Invalid email format' };
	}

	// Check if email is already in use
	const existingUser = await userRepo.findByEmail(input.newEmail);
	if (existingUser && existingUser.id !== input.userId) {
		return { success: false, error: 'Email is already in use' };
	}

	// Get current user
	const user = await userRepo.findById(input.userId);
	if (!user) {
		return { success: false, error: 'User not found' };
	}

	// Update email
	await userRepo.update(input.userId, { email: input.newEmail });

	return { success: true };
}
