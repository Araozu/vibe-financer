function rejectDatabaseAccess() {
	throw new Error('Database access is disabled in tests; mock the required operation.');
}

export const db = {
	transaction: rejectDatabaseAccess,
	select: rejectDatabaseAccess,
	insert: rejectDatabaseAccess,
	update: rejectDatabaseAccess,
	delete: rejectDatabaseAccess
};
