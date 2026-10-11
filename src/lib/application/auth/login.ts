import { userRepo } from '$lib/infra/repos/user.repo';
import { sessionRepo } from '$lib/infra/repos/session.repo';
import { generateSessionToken, generateSessionId } from '$lib/domain/auth';
import { hashPassword, isLegacyPasswordHash, verifyPassword } from '$lib/infra/auth/password';
import { addDays } from 'date-fns';

export interface LoginInput {
	email: string;
	password: string;
}

export async function login(
	input: LoginInput
): Promise<{ success: true; sessionToken: string } | { success: false; error: string }> {
	// Find user by email
	const user = await userRepo.findByEmail(input.email);
	if (!user) {
		return { success: false, error: 'Invalid email or password' };
	}

	// Verify password
	if (!(await verifyPassword(input.password, user.passwordHash))) {
		return { success: false, error: 'Invalid email or password' };
	}

	if (isLegacyPasswordHash(user.passwordHash)) {
		const upgradedHash = await hashPassword(input.password);
		const upgradedUser = await userRepo.replacePasswordHash(
			user.id,
			user.passwordHash,
			upgradedHash
		);
		if (!upgradedUser) {
			// Another login may have upgraded the hash, or the password may have changed.
			const currentUser = await userRepo.findById(user.id);
			if (!currentUser || !(await verifyPassword(input.password, currentUser.passwordHash))) {
				return { success: false, error: 'Invalid email or password' };
			}
		}
	}

	// Create session
	const sessionToken = generateSessionToken();
	const sessionId = generateSessionId(sessionToken);

	// Session expires in 30 days
	const expiresAt = addDays(new Date(), 30);

	await sessionRepo.create({
		id: sessionId,
		userId: user.id,
		expiresAt
	});

	return { success: true, sessionToken };
}
