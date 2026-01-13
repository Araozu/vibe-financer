import { listAccounts } from '$lib/application/account/list-accounts';
import { createAccount } from '$lib/application/account/create-account';
import { createTransaction } from '$lib/application/transaction/create-transaction';
import { createTransfer } from '$lib/application/transaction/create-transfer';
import { listTransactionsByAccount } from '$lib/application/transaction/list-transactions';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { AccountType } from '$lib/domain/account';
import type { TransactionType } from '$lib/domain/transaction';

export const load: PageServerLoad = async () => {
	const accounts = await listAccounts();
	
	const accountsWithData = await Promise.all(accounts.map(async (account) => {
		const transactions = await listTransactionsByAccount(account.id);
		const last10Transactions = transactions.slice(0, 10);
		
		// Month to date chart data
		const now = new Date();
		const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		
		// Filter transactions for this month
		const thisMonthTransactions = transactions.filter(t => t.createdAt >= firstDayOfMonth);
		
		// Calculate daily balances
		// Start with current balance and work backwards to the beginning of the month
		const chartData = [];
		let runningBalance = account.currentBalance;
		
		// Sort transactions by date descending for easier backward calculation
		const sortedTransactions = [...thisMonthTransactions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		
		const today = new Date();
		today.setHours(23, 59, 59, 999);
		
		let txIndex = 0;
		for (let d = new Date(today); d >= firstDayOfMonth; d.setDate(d.getDate() - 1)) {
			const dayStart = new Date(d);
			dayStart.setHours(0, 0, 0, 0);
			
			// Balance at the END of this day is the runningBalance
			chartData.unshift({
				date: new Date(d),
				balance: runningBalance / 100
			});
			
			// Now adjust runningBalance by removing transactions that happened on this day
			// to get the balance at the start of this day (which is the end of previous day)
			while (txIndex < sortedTransactions.length && sortedTransactions[txIndex].createdAt >= dayStart) {
				const tx = sortedTransactions[txIndex];
				if (tx.type === 'income') {
					runningBalance -= tx.amount;
				} else {
					runningBalance += tx.amount;
				}
				txIndex++;
			}
		}

		return {
			...account,
			last10Transactions,
			chartData
		};
	}));

	return { accounts: accountsWithData };
};

export const actions: Actions = {
	createAccount: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const type = formData.get('type') as AccountType;
		const initialBalanceStr = formData.get('initialBalance') as string;
		const currencyCode = formData.get('currencyCode') as string;
		const currencySymbol = formData.get('currencySymbol') as string;
		const color = formData.get('color') as string;

		const initialBalance = Math.round(parseFloat(initialBalanceStr) * 100);

		try {
			await createAccount({
				name,
				description: description || null,
				type,
				initialBalance,
				currentBalance: initialBalance,
				currencyCode,
				currencySymbol,
				color
			});
			return { success: true };
		} catch (error: any) {
			return fail(400, { error: error.message });
		}
	},
	createTransaction: async ({ request }) => {
		const formData = await request.formData();
		const accountId = formData.get('accountId') as string;
		const type = formData.get('type') as TransactionType;
		const amountStr = formData.get('amount') as string;
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const category = formData.get('category') as string;
		const payee = formData.get('payee') as string;
		const targetAccountId = formData.get('targetAccountId') as string;

		const amount = Math.round(parseFloat(amountStr) * 100);

		try {
			// Handle transfer type
			if (type === 'transfer') {
				if (!targetAccountId) {
					return fail(400, { error: 'Target account is required for transfers' });
				}
				await createTransfer({
					fromAccountId: accountId,
					toAccountId: targetAccountId,
					amount,
					name: name || null,
					description: description || null
				});
			} else {
				// Handle regular income/expense transactions
				await createTransaction({
					accountId,
					type,
					amount,
					name: name || null,
					description: description || null,
					category: category || null,
					payee: payee || null,
					targetAccountId: null
				});
			}
			return { success: true };
		} catch (error: any) {
			return fail(400, { error: error.message });
		}
	}
};
