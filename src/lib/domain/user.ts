export interface User {
	id: string;
	email: string;
	passwordHash: string;
	age: number | null;
}

export type CreateUserDTO = Omit<User, 'id'>;
export type UpdateUserDTO = Partial<CreateUserDTO>;

export function validateUserAge(age: number | null): boolean {
    if (age === null) return true;
    return age >= 0 && age <= 150;
}

export function validateEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): boolean {
	return password.length >= 8;
}
