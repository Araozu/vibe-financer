import { sessionRepo } from '$lib/infra/repos/session.repo';
import { userRepo } from '$lib/infra/repos/user.repo';
import { generateSessionId } from '$lib/domain/auth';
import type { User } from '$lib/domain/user';

export interface ValidateSessionResult {
	session: { id: string; userId: string; expiresAt: Date } | null;
	user: User | null;
}

export async function validateSession(sessionToken: string): Promise<ValidateSessionResult> {
	const sessionId = generateSessionId(sessionToken);
	const session = await sessionRepo.findById(sessionId);

	if (!session) {
		return { session: null, user: null };
	}

	// Check if session is expired
	if (session.expiresAt < new Date()) {
		await sessionRepo.deleteById(sessionId);
		return { session: null, user: null };
	}

	// Get user
	const user = await userRepo.findById(session.userId);
	if (!user) {
		await sessionRepo.deleteById(sessionId);
		return { session: null, user: null };
	}

	// Extend session if it's close to expiring (less than 15 days left)
	const fifteenDaysFromNow = new Date();
	fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

	if (session.expiresAt < fifteenDaysFromNow) {
		const newExpiresAt = new Date();
		newExpiresAt.setDate(newExpiresAt.getDate() + 30);

		// Update session expiration (we'll need to add this to the repo)
		await sessionRepo.deleteById(sessionId);
		await sessionRepo.create({
			id: sessionId,
			userId: user.id,
			expiresAt: newExpiresAt
		});

		return {
			session: { id: sessionId, userId: user.id, expiresAt: newExpiresAt },
			user
		};
	}

	return { session, user };
}
