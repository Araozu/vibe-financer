import { sessionRepo } from '$lib/infra/repos/session.repo';

export async function logout(sessionToken: string): Promise<void> {
	const { generateSessionId } = await import('$lib/domain/auth');
	const sessionId = generateSessionId(sessionToken);
	await sessionRepo.deleteById(sessionId);
}
