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
	toAccountId: string | null; // For transfers: the destination account
	createdAt: Date;
	updatedAt: Date;
}

export type CreateTransactionDTO = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export function validateTransactionAmount(amount: number): boolean {
	return amount > 0;
}

export function validateTransferAccounts(fromCurrency: string, toCurrency: string): boolean {
	return fromCurrency === toCurrency;
}

export function calculateNewBalance(currentBalance: number, amount: number, type: TransactionType): number {
	if (type === 'income') {
		return currentBalance + amount;
	}
	if (type === 'transfer') {
		// For transfers, the source account loses money
		return currentBalance - amount;
	}
	return currentBalance - amount;
}
