export interface User {
	id: string;
	name: string | null;
	email: string | null;
	age: number | null;
	defaultCurrencyCode: string;
	defaultCurrencySymbol: string;
}

export type CreateUserDTO = Omit<User, 'id'>;
export type UpdateUserDTO = Partial<CreateUserDTO>;

export function validateUserAge(age: number | null): boolean {
    if (age === null) return true;
    return age >= 0 && age <= 150;
}

export function validateEmail(email: string | null): boolean {
    if (email === null || email === '') return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validateCurrencyCode(code: string | null | undefined): boolean {
    if (!code) return false;
    return code.length === 3 && /^[A-Z]+$/.test(code);
}
