export type AccountType = 'asset' | 'expense' | 'revenue' | 'liability';

export interface Account {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	type: AccountType;
	currentBalance: number;
	initialBalance: number;
	currencyId: string;
	currencyCode?: string | null;
	currencySymbol?: string | null;
	color: string;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateAccountDTO = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAccountDTO = Partial<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

export function validateAccountName(name: string): boolean {
	return name.trim().length >= 1;
}
