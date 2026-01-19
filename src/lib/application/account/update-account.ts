import { accountRepo } from '$lib/infra/repos/account.repo';
import { validateAccountName, validateCurrencyCode, type UpdateAccountDTO } from '$lib/domain/account';

export async function updateAccount(id: string, data: UpdateAccountDTO) {
	if (data.name !== undefined && !validateAccountName(data.name)) {
		throw new Error('Invalid account name');
	}

	if (data.currencyCode !== undefined && !validateCurrencyCode(data.currencyCode)) {
		throw new Error('Invalid currency code (must be 3 uppercase letters)');
	}

	const existing = await accountRepo.findById(id);
	if (!existing) {
		throw new Error('Account not found');
	}

	const updateData: UpdateAccountDTO & { currentBalance?: number } = { ...data };

	if (data.initialBalance !== undefined && data.initialBalance !== existing.initialBalance) {
		const diff = data.initialBalance - existing.initialBalance;
		updateData.currentBalance = existing.currentBalance + diff;
	}

	return await accountRepo.update(id, updateData);
}
