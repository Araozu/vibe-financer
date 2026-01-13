export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
	id: string;
	accountId: string;
	type: TransactionType;
	amount: number; // in cents
	name: string | null;
	description: string | null;
	category: string | null;
	payee: string | null;
	toAccountId: string | null; // For transfers
	createdAt: Date;
	updatedAt: Date;
}

export type CreateTransactionDTO = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export interface CreateTransferDTO {
	fromAccountId: string;
	toAccountId: string;
	amount: number;
	name: string | null;
	description: string | null;
}

export function validateTransactionAmount(amount: number): boolean {
	return amount > 0;
}

export function calculateNewBalance(currentBalance: number, amount: number, type: TransactionType): number {
	if (type === 'income') {
		return currentBalance + amount;
	}
	return currentBalance - amount;
}
