export interface User {
	id: string;
	email: string;
	passwordHash: string;
	age: number | null;
	createdAt: Date;
}

export type CreateUserDTO = Omit<User, 'id' | 'createdAt'>;
export type UpdateUserDTO = Partial<Omit<CreateUserDTO, 'email' | 'passwordHash'>>;

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

export function validateEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): boolean {
	return password.length >= 8;
}
