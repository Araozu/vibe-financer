import { userRepo } from '$lib/infra/repos/user.repo';
import { validatePassword } from '$lib/domain/auth';
import { hashPassword, verifyPassword } from '$lib/infra/auth/password';

export interface ChangePasswordInput {
	userId: string;
	currentPassword: string;
	newPassword: string;
}

export async function changePassword(
	input: ChangePasswordInput
): Promise<{ success: boolean; error?: string }> {
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
	if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
		return { success: false, error: 'Current password is incorrect' };
	}

	// Hash new password
	const newPasswordHash = await hashPassword(input.newPassword);

	// Update password
	const updatedUser = await userRepo.replacePasswordHash(
		input.userId,
		user.passwordHash,
		newPasswordHash
	);
	if (!updatedUser) {
		return { success: false, error: 'Password changed while updating. Please retry.' };
	}

	return { success: true };
}
