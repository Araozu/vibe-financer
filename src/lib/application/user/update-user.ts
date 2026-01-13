import { userRepo } from '$lib/infra/repos/user.repo';
import { validateUserAge, type UpdateUserDTO } from '$lib/domain/user';

export async function updateUser(id: string, data: UpdateUserDTO) {
	if (data.age !== undefined && !validateUserAge(data.age)) {
		throw new Error('Invalid user age');
	}

	const updatedUser = await userRepo.update(id, data);
	if (!updatedUser) {
		throw new Error('User not found');
	}

	return updatedUser;
}
