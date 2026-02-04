import { userRepo } from '$lib/infra/repos/user.repo';
import {
	validateUserAge,
	validatePhoneNumber,
	validateDateOfBirth,
	type UpdateUserDTO
} from '$lib/domain/user';

export async function updateUser(id: string, data: UpdateUserDTO) {
	if (data.age !== undefined && !validateUserAge(data.age)) {
		throw new Error('Invalid user age');
	}

	if (data.phoneNumber !== undefined && !validatePhoneNumber(data.phoneNumber)) {
		throw new Error('Invalid phone number format');
	}

	if (data.dateOfBirth !== undefined && !validateDateOfBirth(data.dateOfBirth)) {
		throw new Error('Invalid date of birth');
	}

	const updatedUser = await userRepo.update(id, data);
	if (!updatedUser) {
		throw new Error('User not found');
	}

	return updatedUser;
}
