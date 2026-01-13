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
	targetAccountId: string | null; // For transfers
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
	if (type === 'expense') {
		return currentBalance - amount;
	}
	// For transfers, balance calculation is handled in the application layer
	return currentBalance;
}

export function validateTransferCurrencies(fromCurrency: string, toCurrency: string): boolean {
	return fromCurrency === toCurrency;
}

export function validateTransferAccounts(fromAccountId: string, toAccountId: string): boolean {
	return fromAccountId !== toAccountId;
}
