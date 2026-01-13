import { userRepo } from '$lib/infra/repos/user.repo';

export async function listUsers() {
	return await userRepo.findAll();
}
