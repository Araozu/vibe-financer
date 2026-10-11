import assert from 'node:assert/strict';
import { test } from 'node:test';
import { db } from './helpers/database.mjs';
import { db as guardedDb } from '../src/lib/infra/db/index.ts';
import { eventStore, account as accountTable } from '../src/lib/infra/db/schema.ts';
import { eventStoreRepo, ConcurrencyError } from '../src/lib/infra/repos/event-store.repo.ts';
import { transactionRepo } from '../src/lib/infra/repos/transaction.repo.ts';
import { sessionRepo } from '../src/lib/infra/repos/session.repo.ts';
import { userRepo } from '../src/lib/infra/repos/user.repo.ts';
import { createTransaction } from '../src/lib/application/transaction/create-transaction.ts';
import { editTransaction } from '../src/lib/application/transaction/edit-transaction.ts';
import { deleteTransaction } from '../src/lib/application/transaction/delete-transaction.ts';
import { createAccount } from '../src/lib/application/account/create-account.ts';
import { updateAccount } from '../src/lib/application/account/update-account.ts';
import { validateSession } from '../src/lib/application/auth/validate-session.ts';
import { getAccountState } from '../src/lib/application/account/account-projection.ts';
import { handle } from '../src/hooks.server.ts';

const account = {
	id: 'source',
	userId: 'user',
	name: 'Checking',
	description: null,
	type: 'asset',
	initialBalance: 1000,
	currentBalance: 1000,
	currencyId: 'usd',
	color: '#000000',
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-01T00:00:00Z'),
	isDeleted: false,
	version: 1
};

const transaction = {
	id: 'transaction',
	accountId: 'source',
	type: 'expense',
	amount: 100,
	destinationAmount: null,
	name: null,
	description: null,
	category: null,
	budgetId: null,
	payee: null,
	toAccountId: null,
	deletedAt: null,
	createdAt: new Date('2026-01-02T00:00:00Z'),
	updatedAt: new Date('2026-01-02T00:00:00Z')
};

function mockAccount(t, state = account) {
	t.mock.method(eventStoreRepo, 'getLatestSnapshot', async () => ({
		state,
		version: state.version
	}));
	t.mock.method(eventStoreRepo, 'getStreamAfterVersion', async () => []);
	t.mock.method(eventStoreRepo, 'getGoalByAccount', async () => null);
}

test('creating a transaction rejects a stale account instead of adopting a newer version', async (t) => {
	mockAccount(t);
	t.mock.method(eventStoreRepo, 'getStreamVersion', async () => 2);
	t.mock.method(eventStoreRepo, 'runInTransaction', async (callback) => callback({}));
	t.mock.method(eventStoreRepo, 'append', async (event, options) => {
		assert.equal(event.version, 2);
		assert.equal(options.expectedVersion, 1);
		throw new ConcurrencyError(event.streamId, options.expectedVersion, 2);
	});
	const update = t.mock.method(eventStoreRepo, 'updateAccountProjection', async () => {});
	await assert.rejects(createTransaction({ ...transaction, accountId: 'source' }, 'user'), {
		status: 409
	});
	assert.equal(update.mock.callCount(), 0);
});

test('self-transfers are rejected before any event is written', async (t) => {
	mockAccount(t);
	t.mock.method(eventStoreRepo, 'getStreamVersion', async () => 1);
	const write = t.mock.method(eventStoreRepo, 'runInTransaction', async () => {
		assert.fail('A self-transfer must not reach persistence');
	});
	await assert.rejects(
		createTransaction({ ...transaction, type: 'transfer', toAccountId: 'source' }, 'user'),
		{ status: 400 }
	);
	assert.equal(write.mock.callCount(), 0);
});

test('deleted transactions cannot be edited or returned as successful no-op edits', async (t) => {
	t.mock.method(transactionRepo, 'findById', async () => ({
		...transaction,
		deletedAt: new Date()
	}));
	await assert.rejects(editTransaction('transaction', {}, 'user'), { status: 404 });
});

test('account creation stores its event and projection in one transaction', async (t) => {
	const tx = {};
	t.mock.method(eventStoreRepo, 'getCurrencyById', async () => ({ id: 'usd' }));
	const run = t.mock.method(eventStoreRepo, 'runInTransaction', async (callback) => callback(tx));
	t.mock.method(eventStoreRepo, 'append', async (_event, options, externalTx) => {
		assert.deepEqual(options, { expectedVersion: 0 });
		assert.equal(externalTx, tx);
	});
	t.mock.method(eventStoreRepo, 'createAccountProjection', async (_data, externalTx) => {
		assert.equal(externalTx, tx);
	});
	await createAccount(account);
	assert.equal(run.mock.callCount(), 1);
});

test('account updates use the replayed version and keep event/projection writes atomic', async (t) => {
	mockAccount(t);
	const versionRead = t.mock.method(eventStoreRepo, 'getStreamVersion', async () => 2);
	const tx = {};
	t.mock.method(eventStoreRepo, 'runInTransaction', async (callback) => callback(tx));
	t.mock.method(eventStoreRepo, 'append', async (event, options, externalTx) => {
		assert.equal(options.expectedVersion, 1);
		assert.equal(event.version, 2);
		assert.equal(externalTx, tx);
	});
	t.mock.method(eventStoreRepo, 'updateAccountProjection', async (_id, data, externalTx) => {
		assert.equal(data.currentBalance, 1100);
		assert.equal(externalTx, tx);
	});
	const updated = await updateAccount('source', { initialBalance: 1100 }, 'user');
	assert.equal(updated.currentBalance, 1100);
	assert.equal(versionRead.mock.callCount(), 0);
});

test('snapshot reads fetch the current goal even when no account events were added', async (t) => {
	mockAccount(t, { ...account, goal: { id: 'outdated-goal' } });
	const goal = { id: 'current-goal' };
	t.mock.method(eventStoreRepo, 'getGoalByAccount', async () => goal);
	assert.equal((await getAccountState('source')).goal, goal);
});

test('session renewal updates the existing row without deleting or recreating it', async (t) => {
	const existing = { id: 'session', userId: 'user', expiresAt: new Date(Date.now() + 86400000) };
	t.mock.method(sessionRepo, 'findById', async () => existing);
	t.mock.method(userRepo, 'findById', async () => ({ id: 'user' }));
	const deleted = t.mock.method(sessionRepo, 'deleteById', async () => {});
	const created = t.mock.method(sessionRepo, 'create', async () => {});
	const tx = {
		set: ({ expiresAt }) => {
			assert.ok(expiresAt instanceof Date);
			return { where: () => ({ returning: async () => [{ ...existing, expiresAt }] }) };
		}
	};
	const updated = t.mock.method(db, 'update', () => tx);
	const result = await validateSession('token');
	assert.equal(updated.mock.callCount(), 1);
	assert.equal(deleted.mock.callCount(), 0);
	assert.equal(created.mock.callCount(), 0);
	assert.ok(result.session.expiresAt > existing.expiresAt);
});

test('event appends reject nonsequential versions before inserting', async (t) => {
	t.mock.method(eventStoreRepo, 'getStreamVersion', async () => 1);
	const insert = t.mock.fn(() => assert.fail('Invalid versions must not be inserted'));
	t.mock.method(db, 'transaction', async (callback) => callback({ insert }));
	await assert.rejects(
		eventStoreRepo.append({ streamId: 'source', version: 9 }, { expectedVersion: 1 })
	);
	assert.equal(insert.mock.callCount(), 0);
});

test('event stream unique conflicts become concurrency errors', async (t) => {
	t.mock.method(eventStoreRepo, 'getStreamVersion', async () => 1);
	t.mock.method(db, 'transaction', async (callback) =>
		callback({
			insert: () => ({
				values: () => ({
					returning: async () => {
						throw Object.assign(new Error('Query failed'), {
							cause: { code: '23505', constraint: 'idx_event_store_stream' }
						});
					}
				})
			})
		})
	);
	await assert.rejects(
		eventStoreRepo.append({ streamId: 'source', version: 2 }, { expectedVersion: 1 }),
		{ name: 'ConcurrencyError' }
	);
});

test('the test harness prevents unmocked database access', () => {
	assert.equal(guardedDb, db);
	assert.throws(() => db.select(), /Database access is disabled in tests/);
});

test('invalid creation dates and fractional edit amounts are rejected before writes', async (t) => {
	mockAccount(t);
	t.mock.method(transactionRepo, 'findById', async () => transaction);
	await assert.rejects(createTransaction({ ...transaction, createdAt: new Date(NaN) }, 'user'), {
		status: 400
	});
	await assert.rejects(editTransaction('transaction', { amount: 1.5 }, 'user'), { status: 400 });
	await assert.rejects(editTransaction('transaction', { transactionDate: new Date(NaN) }, 'user'), {
		status: 400
	});
});

test('no-op edits still enforce account ownership', async (t) => {
	mockAccount(t, { ...account, userId: 'someone-else' });
	t.mock.method(transactionRepo, 'findById', async () => transaction);
	await assert.rejects(editTransaction('transaction', {}, 'user'), { status: 404 });
});

function mockLockedTransaction(current) {
	return {
		select: () => ({
			from: () => ({
				where: () => ({
					for: async (lock) => {
						assert.equal(lock, 'update');
						return current ? [current] : [];
					}
				})
			})
		})
	};
}

test('edit and delete reject transaction changes even when timestamps match', async (t) => {
	mockAccount(t, { ...account, version: 2, currentBalance: 900 });
	t.mock.method(transactionRepo, 'findById', async () => transaction);
	const locked = mockLockedTransaction({ ...transaction, amount: 150 });
	t.mock.method(eventStoreRepo, 'runInTransaction', async (callback) => callback(locked));
	const appended = t.mock.method(eventStoreRepo, 'append', async () => {});
	await assert.rejects(editTransaction('transaction', { amount: 200 }, 'user'), { status: 409 });
	await assert.rejects(deleteTransaction('transaction', 'user'), { status: 409 });
	assert.equal(appended.mock.callCount(), 0);
});

test('successful edits and deletes use the version of the replayed account balance', async (t) => {
	mockAccount(t, { ...account, version: 2, currentBalance: 900 });
	t.mock.method(transactionRepo, 'findById', async () => transaction);
	const versionRead = t.mock.method(eventStoreRepo, 'getStreamVersion', async () => 3);
	const locked = mockLockedTransaction(transaction);
	t.mock.method(eventStoreRepo, 'runInTransaction', async (callback) => callback(locked));
	const appended = t.mock.method(eventStoreRepo, 'append', async (event, options, externalTx) => {
		assert.equal(event.version, 3);
		assert.equal(options.expectedVersion, 2);
		assert.equal(externalTx, locked);
	});
	const balances = [];
	t.mock.method(eventStoreRepo, 'updateAccountProjection', async (_id, data, externalTx) => {
		assert.equal(externalTx, locked);
		balances.push(data.currentBalance);
	});
	t.mock.method(eventStoreRepo, 'updateTransactionProjection', async (_id, _data, externalTx) => {
		assert.equal(externalTx, locked);
	});
	const updated = await editTransaction('transaction', { amount: 200 }, 'user');
	assert.equal(updated.amount, 200);
	await deleteTransaction('transaction', 'user');
	assert.deepEqual(balances, [800, 1000]);
	assert.equal(appended.mock.callCount(), 2);
	assert.equal(versionRead.mock.callCount(), 0);
});

test('cross-currency transfers use both replayed versions and persist the converted amount', async (t) => {
	const source = { ...account, version: 2 };
	const destination = {
		...account,
		id: 'destination',
		currencyId: 'eur',
		version: 7,
		currentBalance: 2000
	};
	mockAccount(t);
	t.mock.method(eventStoreRepo, 'getLatestSnapshot', async (id) => {
		const state = id === 'source' ? source : destination;
		return { state, version: state.version };
	});
	const tx = {};
	t.mock.method(eventStoreRepo, 'runInTransaction', async (callback) => callback(tx));
	const appended = t.mock.method(eventStoreRepo, 'append', async (event, options, externalTx) => {
		const expectedVersion = event.streamId === 'source' ? 2 : 7;
		assert.equal(event.version, expectedVersion + 1);
		assert.equal(options.expectedVersion, expectedVersion);
		assert.equal(externalTx, tx);
	});
	const balances = {};
	t.mock.method(eventStoreRepo, 'updateAccountProjection', async (id, data, externalTx) => {
		assert.equal(externalTx, tx);
		balances[id] = data.currentBalance;
	});
	t.mock.method(eventStoreRepo, 'createTransactionProjection', async (data, externalTx) => {
		assert.equal(data.destinationAmount, 150);
		assert.equal(data.budgetId, null);
		assert.equal(externalTx, tx);
	});
	const created = await createTransaction(
		{ ...transaction, type: 'transfer', toAccountId: 'destination', exchangeRate: 1.5 },
		'user'
	);
	assert.equal(created.destinationAmount, 150);
	assert.deepEqual(balances, { source: 900, destination: 2150 });
	assert.equal(appended.mock.callCount(), 2);
	for (const exchangeRate of [Number.MAX_VALUE, 0.0001]) {
		await assert.rejects(
			createTransaction(
				{ ...transaction, type: 'transfer', toAccountId: 'destination', exchangeRate },
				'user'
			),
			{ status: 400 }
		);
	}
	assert.equal(appended.mock.callCount(), 2);
});

test('session renewal does not restore a session removed by logout', async (t) => {
	t.mock.method(sessionRepo, 'findById', async () => ({
		id: 'session',
		userId: 'user',
		expiresAt: new Date(Date.now() + 86400000)
	}));
	t.mock.method(userRepo, 'findById', async () => ({ id: 'user' }));
	t.mock.method(sessionRepo, 'updateExpiration', async () => undefined);
	const create = t.mock.method(sessionRepo, 'create', async () => {});
	assert.deepEqual(await validateSession('token'), { session: null, user: null });
	assert.equal(create.mock.callCount(), 0);
});

test('session cookies track the server expiration for sliding sessions', async (t) => {
	const session = {
		id: 'session',
		userId: 'user',
		expiresAt: new Date(Date.now() + 30 * 86400000)
	};
	const user = { id: 'user' };
	t.mock.method(sessionRepo, 'findById', async () => session);
	t.mock.method(userRepo, 'findById', async () => user);
	const setCookie = t.mock.fn();
	const event = { locals: {}, cookies: { get: () => 'token', set: setCookie } };
	const response = await handle({ event, resolve: async () => 'resolved' });
	assert.equal(response, 'resolved');
	assert.equal(event.locals.user, user);
	assert.equal(setCookie.mock.callCount(), 1);
	const [name, token, options] = setCookie.mock.calls[0].arguments;
	assert.equal(name, 'session');
	assert.equal(token, 'token');
	assert.equal(options.expires, session.expiresAt);
	assert.equal(options.httpOnly, true);
});

test('appendMany enforces contiguous versions on every stream', async (t) => {
	const versions = new Map();
	t.mock.method(eventStoreRepo, 'getStreamVersion', async (id) => versions.get(id) ?? 0);
	t.mock.method(db, 'transaction', async (callback) =>
		callback({
			insert: () => ({
				values: (row) => ({
					returning: async () => {
						versions.set(row.streamId, row.version);
						return [row];
					}
				})
			})
		})
	);
	const events = [
		{ streamId: 'source', version: 1 },
		{ streamId: 'destination', version: 1 },
		{ streamId: 'source', version: 2 }
	];
	const results = await eventStoreRepo.appendMany(events, { expectedVersion: 0 });
	assert.equal(results.length, 3);
	await assert.rejects(eventStoreRepo.appendMany([{ streamId: 'destination', version: 3 }]), {
		name: 'ConcurrencyError'
	});
	assert.equal(versions.get('destination'), 1);
});

test('account creation cannot commit an event when its projection fails', async (t) => {
	t.mock.method(eventStoreRepo, 'getCurrencyById', async () => ({ id: 'usd' }));
	t.mock.method(eventStoreRepo, 'getStreamVersion', async () => 0);
	const committed = [];
	const inserted = [];
	t.mock.method(db, 'transaction', async (callback) => {
		const staged = [];
		const result = await callback({
			insert: (table) => {
				inserted.push(table);
				if (table === eventStore) {
					return {
						values: (row) => ({
							returning: async () => {
								staged.push(row);
								return [row];
							}
						})
					};
				}
				assert.equal(table, accountTable);
				return {
					values: async () => {
						throw new Error('Projection write failed');
					}
				};
			}
		});
		committed.push(...staged);
		return result;
	});
	await assert.rejects(createAccount(account), /Projection write failed/);
	assert.deepEqual(inserted, [eventStore, accountTable]);
	assert.deepEqual(committed, []);
});

test('moving a transaction uses both account versions without mutating the update input', async (t) => {
	const source = { ...account, version: 2, currentBalance: 900 };
	const destination = {
		...account,
		id: 'destination',
		currencyId: 'eur',
		version: 7,
		currentBalance: 2000
	};
	const current = { ...transaction, budgetId: 'budget' };
	mockAccount(t);
	t.mock.method(eventStoreRepo, 'getLatestSnapshot', async (id) => {
		const state = id === 'source' ? source : destination;
		return { state, version: state.version };
	});
	t.mock.method(transactionRepo, 'findById', async () => current);
	const tx = mockLockedTransaction(current);
	t.mock.method(eventStoreRepo, 'runInTransaction', async (callback) => callback(tx));
	const appended = t.mock.method(eventStoreRepo, 'append', async (event, options, externalTx) => {
		const expectedVersion = event.streamId === 'source' ? 2 : 7;
		assert.equal(event.version, expectedVersion + 1);
		assert.equal(options.expectedVersion, expectedVersion);
		assert.equal(externalTx, tx);
	});
	const balances = {};
	t.mock.method(eventStoreRepo, 'updateAccountProjection', async (id, data) => {
		balances[id] = data.currentBalance;
	});
	t.mock.method(eventStoreRepo, 'updateTransactionProjection', async (_id, data) => {
		assert.equal(data.accountId, 'destination');
		assert.equal(data.budgetId, null);
	});
	const input = Object.freeze({ accountId: 'destination' });
	const updated = await editTransaction('transaction', input, 'user');
	assert.equal(updated.budgetId, null);
	assert.equal(updated.accountId, 'destination');
	assert.deepEqual(input, { accountId: 'destination' });
	assert.deepEqual(balances, { source: 1000, destination: 1900 });
	assert.equal(appended.mock.callCount(), 2);
});
