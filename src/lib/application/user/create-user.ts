import { userRepo } from '$lib/infra/repos/user.repo';
import { validateUserAge, type CreateUserDTO } from '$lib/domain/user';

export async function createUser(data: CreateUserDTO) {
	if (!validateUserAge(data.age)) {
		throw new Error('Invalid user age');
	}

	return await userRepo.create(data);
}
