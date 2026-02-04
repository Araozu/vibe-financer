import type { Transaction } from './transaction';

export interface DailySpending {
	date: Date;
	amount: number;
	label: string; // e.g., 'M', 'T', 'W', etc.
}

/**
 * Calculates daily spending for the last N days.
 * @param transactions List of transactions
 * @param days Number of days to look back
 * @param endDate The reference end date (defaults to now)
 * @returns Array of DailySpending objects
 */
export function calculateDailySpending(
	transactions: Transaction[],
	days: number = 7,
	endDate: Date = new Date()
): DailySpending[] {
	const result: DailySpending[] = [];
	const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	// Normalize endDate to start of day for consistent comparison
	const end = new Date(endDate);
	end.setHours(23, 59, 59, 999);

	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(end);
		date.setDate(date.getDate() - i);
		date.setHours(0, 0, 0, 0);

		const nextDay = new Date(date);
		nextDay.setDate(nextDay.getDate() + 1);

		const daySpending = transactions
			.filter((tx) => {
				const txDate = new Date(tx.createdAt);
				return (
					tx.type === 'expense' &&
					txDate >= date &&
					txDate < nextDay &&
					!tx.deletedAt
				);
			})
			.reduce((sum, tx) => sum + tx.amount, 0);

		result.push({
			date: new Date(date),
			amount: daySpending,
			label: dayLabels[date.getDay()]
		});
	}

	return result;
}
