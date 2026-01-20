import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteTransaction } from '$lib/application/transaction/delete-transaction';
import { transactionRepo } from '$lib/infra/repos/transaction.repo';

/**
 * DELETE /api/transactions/[id]
 *
 * Soft-delete a transaction by creating a TransactionDeleted event.
 * This maintains the audit trail while removing the transaction from the UI.
 * The account balance is adjusted back as if the transaction never happened.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const transactionId = params.id;

	try {
		// First verify the transaction exists and user owns it
		const tx = await transactionRepo.findById(transactionId);
		
		if (!tx) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		// TODO: Add ownership verification by checking if transaction's account belongs to user
		// For now, we trust that the application layer handles this

		// Delete the transaction
		await deleteTransaction(transactionId, locals.user.id);

		return json({ success: true, message: 'Transaction deleted successfully' });
	} catch (error) {
		console.error('Error deleting transaction:', error);
		
		// Handle different error types
		if (error && typeof error === 'object') {
			const e = error as { status?: number; message?: string; body?: { message?: string } };
			
			// Propagate SvelteKit errors (from throw error())
			if (typeof e.status === 'number' && e.status >= 400 && e.status < 600) {
				return json(
					{ error: e.body?.message ?? e.message ?? 'Request failed' },
					{ status: e.status }
				);
			}
		}
		
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
