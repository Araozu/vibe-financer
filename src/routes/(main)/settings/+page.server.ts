import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { updateUser } from '$lib/application/user/update-user';
import { changePassword } from '$lib/application/user/change-password';
import { changeEmail } from '$lib/application/user/change-email';
import { accountRepo } from '$lib/infra/repos/account.repo';
import type { UpdateUserDTO } from '$lib/domain/user';

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const firstName = formData.get('firstName') as string | null;
		const lastName = formData.get('lastName') as string | null;
		const phoneNumber = formData.get('phoneNumber') as string | null;
		const dateOfBirth = formData.get('dateOfBirth') as string | null;
		const preferredCurrency = formData.get('preferredCurrency') as string | null;
		const timezone = formData.get('timezone') as string | null;
		const ageStr = formData.get('age') as string | null;
		const defaultAccountId = formData.get('defaultAccountId') as string | null;

		try {
			const updateData: Partial<UpdateUserDTO> = {};

			if (firstName !== null) updateData.firstName = firstName ?? null;
			if (lastName !== null) updateData.lastName = lastName ?? null;
			if (phoneNumber !== null) updateData.phoneNumber = phoneNumber ?? null;
			if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
			if (preferredCurrency !== null) updateData.preferredCurrency = preferredCurrency ?? null;
			if (timezone !== null) updateData.timezone = timezone ?? null;
			if (ageStr !== null) {
				const age = parseInt(ageStr);
				updateData.age = isNaN(age) ? null : age;
			}
			if (defaultAccountId !== undefined) {
				if (defaultAccountId) {
					const account = await accountRepo.findById(defaultAccountId);
					if (!account || account.userId !== locals.user.id) {
						return fail(400, { error: 'Invalid account selected' });
					}
				}
				updateData.defaultAccountId = defaultAccountId || null;
			}

			await updateUser(locals.user.id, updateData);

			return { success: true, message: 'Profile updated successfully' };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Failed to update profile'
			});
		}
	},

	changePassword: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { error: 'All password fields are required' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { error: 'New passwords do not match' });
		}

		const result = await changePassword({
			userId: locals.user.id,
			currentPassword,
			newPassword
		});

		if (!result.success) {
			return fail(400, { error: result.error });
		}

		return { success: true, message: 'Password changed successfully' };
	},

	changeEmail: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const newEmail = formData.get('newEmail') as string;

		if (!newEmail) {
			return fail(400, { error: 'Email is required' });
		}

		const result = await changeEmail({
			userId: locals.user.id,
			newEmail
		});

		if (!result.success) {
			return fail(400, { error: result.error });
		}

		return { success: true, message: 'Email changed successfully' };
	}
};
