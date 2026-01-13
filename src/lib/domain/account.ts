export type AccountType = 'asset' | 'expense' | 'revenue' | 'liability';

export interface Account {
	id: string;
	name: string;
	type: AccountType;
	currentBalance: number;
	initialBalance: number;
	currencyCode: string;
	currencySymbol: string;
	color: string;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateAccountDTO = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>;

export function validateAccountName(name: string): boolean {
	return name.trim().length >= 1;
}

export function validateCurrencyCode(code: string): boolean {
	return /^[A-Z]{3}$/.test(code);
}
