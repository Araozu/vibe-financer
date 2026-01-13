import { userRepo } from '$lib/infra/repos/user.repo';
import { validateUserAge, validateEmail, validateCurrencyCode, type CreateUserDTO } from '$lib/domain/user';

export async function createUser(data: CreateUserDTO) {
	if (!validateUserAge(data.age)) {
		throw new Error('Invalid user age');
	}
	
	if (!validateEmail(data.email)) {
		throw new Error('Invalid email format');
	}
	
	if (!validateCurrencyCode(data.defaultCurrencyCode)) {
		throw new Error('Invalid currency code. Must be 3 uppercase letters');
	}

	return await userRepo.create(data);
}
