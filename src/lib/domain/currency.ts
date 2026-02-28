export const DEFAULT_CURRENCY_SYMBOL = '$';

export interface Currency {
	id: string;
	code: string; // e.g., "USD"
	symbol: string; // e.g., "$"
	name: string; // e.g., "US Dollar"
}

export function validateCurrencyCode(code: string): boolean {
	return /^[A-Z]{3}$/.test(code);
}

export function validateCurrencySymbol(symbol: string): boolean {
	return symbol.trim().length >= 1;
}

export function validateCurrencyName(name: string): boolean {
	return name.trim().length >= 1;
}
