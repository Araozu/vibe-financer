export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
	id: string;
	accountId: string;
	type: TransactionType;
	amount: number; // in cents
	name: string | null;
	description: string | null;
	category: string | null;
	/** Optional link to a budget row; category string remains the display label. */
	budgetId: string | null;
	budgetIcon?: string | null;
	budgetColor?: string | null;
	budgetCategory?: string | null;
	payee: string | null;
	toAccountId: string | null; // For transfers: the destination account
	deletedAt: Date | null; // Soft delete timestamp for audit trail
	createdAt: Date;
	updatedAt: Date;
}

export type CreateTransactionDTO = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & {
	createdAt?: Date;
	/** Exchange rate for cross-currency transfers: 1 unit of source currency = exchangeRate units of destination currency. Required when source and destination currencies differ. */
	exchangeRate?: number | null;
};

export function validateTransactionAmount(amount: number): boolean {
	return amount > 0;
}

/**
 * Validate an exchange rate value.
 * Returns true if the rate is a positive finite number.
 */
export function validateExchangeRate(rate: number | null | undefined): rate is number {
	return rate != null && Number.isFinite(rate) && rate > 0;
}

/**
 * Parse an exchange rate string from form data.
 * Returns the parsed number or null when absent/empty.
 */
export function parseExchangeRate(value: string | null): number | null {
	if (value == null || value === '') return null;
	const parsed = parseFloat(value);
	return Number.isNaN(parsed) ? null : parsed;
}

export function calculateNewBalance(
	currentBalance: number,
	amount: number,
	type: TransactionType
): number {
	if (type === 'income') {
		return currentBalance + amount;
	}
	if (type === 'transfer') {
		// For transfers, the source account loses money
		return currentBalance - amount;
	}
	return currentBalance - amount;
}
