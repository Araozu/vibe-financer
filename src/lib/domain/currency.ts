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

/** Formats cents as `-$1,234.56`, keeping the sign ahead of the symbol. */
export function formatMoney(
	amountInCents: number,
	symbol: string = DEFAULT_CURRENCY_SYMBOL,
	{ wholeUnits = false }: { wholeUnits?: boolean } = {}
): string {
	const digits = wholeUnits ? 0 : 2;
	const formatted = (Math.abs(amountInCents) / 100).toLocaleString('en-US', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
	return `${amountInCents < 0 ? '-' : ''}${symbol}${formatted}`;
}
