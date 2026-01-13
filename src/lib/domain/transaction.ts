export type TransactionType = 'expense' | 'income';

export interface Transaction {
	id: string;
	accountId: string;
	type: TransactionType;
	amount: number; // in cents
	name: string | null;
	description: string | null;
	category: string | null;
	payee: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateTransactionDTO = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export function validateTransactionAmount(amount: number): boolean {
	return amount > 0;
}

export function calculateNewBalance(currentBalance: number, amount: number, type: TransactionType): number {
	if (type === 'income') {
		return currentBalance + amount;
	}
	return currentBalance - amount;
}
