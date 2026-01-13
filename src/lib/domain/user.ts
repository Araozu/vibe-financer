export interface User {
	id: string;
	age: number | null;
}

export type CreateUserDTO = Omit<User, 'id'>;
export type UpdateUserDTO = Partial<CreateUserDTO>;

export function validateUserAge(age: number | null): boolean {
    if (age === null) return true;
    return age >= 0 && age <= 150;
}
