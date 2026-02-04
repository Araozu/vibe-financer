export interface User {
	id: string;
	email: string;
	passwordHash: string;
	firstName: string | null;
	lastName: string | null;
	phoneNumber: string | null;
	dateOfBirth: Date | null;
	preferredCurrency: string | null;
	timezone: string | null;
	age: number | null;
	createdAt: Date;
}

export type CreateUserDTO = Omit<User, 'id' | 'createdAt'>;
export type UpdateUserDTO = Partial<Omit<CreateUserDTO, 'passwordHash'>>;

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
}

export type CreateSessionDTO = Session;

export function validateUserAge(age: number | null): boolean {
	if (age === null) return true;
	return age >= 0 && age <= 150;
}

export function validatePhoneNumber(phone: string | null): boolean {
	if (phone === null || phone === '') return true;
	// Basic phone validation - allows digits, spaces, dashes, parentheses, and plus sign
	// TODO: Consider using a library like libphonenumber-js for more robust validation
	const phoneRegex = /^[\d\s\-+()]+$/;
	return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export function validateDateOfBirth(dob: Date | null): boolean {
	if (dob === null) return true;
	const today = new Date();
	const birthDate = new Date(dob);
	// Must be in the past and not more than 150 years ago
	const maxDate = new Date();
	maxDate.setFullYear(maxDate.getFullYear() - 150);
	return birthDate < today && birthDate > maxDate;
}
