import { accountRepo } from '$lib/infra/repos/account.repo';
import { validateAccountName, validateCurrencyCode, type CreateAccountDTO } from '$lib/domain/account';

export async function createAccount(data: CreateAccountDTO) {
	if (!validateAccountName(data.name)) {
		throw new Error('Invalid account name');
	}

	if (!validateCurrencyCode(data.currencyCode)) {
		throw new Error('Invalid currency code (must be 3 uppercase letters)');
	}

	// Ensure currentBalance matches initialBalance if not provided or just as a rule
	const accountData = {
		...data,
		currentBalance: data.currentBalance ?? data.initialBalance
	};

	return await accountRepo.create(accountData);
}
