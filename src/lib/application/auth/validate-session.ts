import { sessionRepo } from '$lib/infra/repos/session.repo';
import { userRepo } from '$lib/infra/repos/user.repo';
import { generateSessionId } from '$lib/domain/auth';
import type { User } from '$lib/domain/user';
import { addDays } from 'date-fns';

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

	const now = new Date();
	// Check if session is expired
	if (session.expiresAt <= now) {
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
	const fifteenDaysFromNow = addDays(now, 15);

	if (session.expiresAt < fifteenDaysFromNow) {
		const renewedSession = await sessionRepo.updateExpiration(sessionId, addDays(now, 30));
		// Logout may have removed the session since it was read. Never recreate it.
		return renewedSession ? { session: renewedSession, user } : { session: null, user: null };
	}

	return { session, user };
}
