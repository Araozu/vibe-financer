import { userRepo } from '$lib/infra/repos/user.repo';
import { sessionRepo } from '$lib/infra/repos/session.repo';
import { verifyPassword, generateSessionToken, generateSessionId } from '$lib/domain/auth';

export interface LoginInput {
	email: string;
	password: string;
}

export async function login(input: LoginInput): Promise<{ success: true; sessionToken: string } | { success: false; error: string }> {
	// Find user by email
	const user = await userRepo.findByEmail(input.email);
	if (!user) {
		return { success: false, error: 'Invalid email or password' };
	}

	// Verify password
	if (!verifyPassword(input.password, user.passwordHash)) {
		return { success: false, error: 'Invalid email or password' };
	}

	// Create session
	const sessionToken = generateSessionToken();
	const sessionId = generateSessionId(sessionToken);
	
	// Session expires in 30 days
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 30);

	await sessionRepo.create({
		id: sessionId,
		userId: user.id,
		expiresAt
	});

	return { success: true, sessionToken };
}
