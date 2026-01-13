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

export type CreateSessionDTO = Omit<Session, ''>;

export function validateUserAge(age: number | null): boolean {
    if (age === null) return true;
    return age >= 0 && age <= 150;
}
