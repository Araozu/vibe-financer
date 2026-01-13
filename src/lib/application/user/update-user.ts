import { userRepo } from '$lib/infra/repos/user.repo';
import { validateUserAge, validateEmail, validateCurrencyCode, type UpdateUserDTO } from '$lib/domain/user';

export async function updateUser(id: string, data: UpdateUserDTO) {
	if (data.age !== undefined && !validateUserAge(data.age)) {
		throw new Error('Invalid user age');
	}
	
	if (data.email !== undefined && !validateEmail(data.email)) {
		throw new Error('Invalid email format');
	}
	
	if (data.defaultCurrencyCode !== undefined && !validateCurrencyCode(data.defaultCurrencyCode)) {
		throw new Error('Invalid currency code. Must be 3 uppercase letters');
	}

	const updatedUser = await userRepo.update(id, data);
	if (!updatedUser) {
		throw new Error('User not found');
	}

	return updatedUser;
}
