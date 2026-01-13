import { userRepo } from '$lib/infra/repos/user.repo';
import { hashPassword, verifyPassword, validatePassword } from '$lib/domain/auth';

export interface ChangePasswordInput {
	userId: string;
	currentPassword: string;
	newPassword: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<{ success: boolean; error?: string }> {
	// Validate new password
	const passwordError = validatePassword(input.newPassword);
	if (passwordError) {
		return { success: false, error: passwordError };
	}

	// Get current user
	const user = await userRepo.findById(input.userId);
	if (!user) {
		return { success: false, error: 'User not found' };
	}

	// Verify current password
	if (!verifyPassword(input.currentPassword, user.passwordHash)) {
		return { success: false, error: 'Current password is incorrect' };
	}

	// Hash new password
	const newPasswordHash = hashPassword(input.newPassword);

	// Update password
	await userRepo.update(input.userId, { passwordHash: newPasswordHash });

	return { success: true };
}
