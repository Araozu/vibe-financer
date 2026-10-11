import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { db } from './helpers/database.mjs';
import { user as userTable } from '../src/lib/infra/db/schema.ts';
import {
	hashPassword,
	isLegacyPasswordHash,
	verifyPassword
} from '../src/lib/infra/auth/password.ts';
import { userRepo } from '../src/lib/infra/repos/user.repo.ts';
import { sessionRepo } from '../src/lib/infra/repos/session.repo.ts';
import { login } from '../src/lib/application/auth/login.ts';
import { signup } from '../src/lib/application/auth/signup.ts';
import { changePassword } from '../src/lib/application/user/change-password.ts';
import { generateSessionId } from '../src/lib/domain/auth.ts';

const password = 'correct horse battery staple 🦊';
const newPassword = 'a different correct password';
const legacyHash = createHash('sha256').update(password, 'utf8').digest('hex');
const modernHash = await hashPassword(password);
const legacyUser = { id: 'user', email: 'user@example.com', passwordHash: legacyHash };

test('Argon2id hashes use distinct random salts and reject incorrect passwords', async () => {
	const otherHash = await hashPassword(password);
	assert.match(modernHash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
	assert.notEqual(modernHash, otherHash);
	assert.equal(await verifyPassword(password, modernHash), true);
	assert.equal(await verifyPassword(password, otherHash), true);
	assert.equal(await verifyPassword('wrong password', modernHash), false);
	assert.equal(isLegacyPasswordHash(modernHash), false);
});

test('legacy SHA-256 hashes remain valid with the original UTF-8 password encoding', async () => {
	assert.equal(isLegacyPasswordHash(legacyHash), true);
	assert.equal(await verifyPassword(password, legacyHash), true);
	assert.equal(await verifyPassword('wrong password', legacyHash), false);
});

test('malformed hashes and unsupported costs fail authentication', async () => {
	const salt = modernHash.split('$')[4];
	const digest = modernHash.split('$')[5];
	const invalidHashes = [
		'',
		'not a hash',
		'a'.repeat(63),
		legacyHash + '\n',
		modernHash + '\n',
		modernHash + '$extra',
		modernHash.replace('argon2id', 'argon2i'),
		modernHash.replace('v=19', 'v=16'),
		modernHash.replace('m=19456', 'm=4294967295'),
		modernHash.replace('t=2', 't=4294967295'),
		modernHash.replace(salt, salt.slice(1)),
		modernHash.replace(digest, digest.slice(1)),
		modernHash.replace(salt, '='.repeat(salt.length))
	];
	for (const hash of invalidHashes) {
		assert.equal(await verifyPassword(password, hash), false);
	}
});

test('signup stores an Argon2id hash rather than plaintext or SHA-256', async (t) => {
	t.mock.method(userRepo, 'count', async () => 0);
	t.mock.method(userRepo, 'findByEmail', async () => undefined);
	const create = t.mock.method(userRepo, 'create', async (data) => {
		assert.equal(isLegacyPasswordHash(data.passwordHash), false);
		assert.equal(await verifyPassword(password, data.passwordHash), true);
		return { ...data, id: 'user' };
	});
	assert.deepEqual(await signup({ email: legacyUser.email, password }), {
		success: true,
		userId: 'user'
	});
	assert.equal(create.mock.callCount(), 1);
});

test('successful legacy logins upgrade the verified hash and create a working session', async (t) => {
	t.mock.method(userRepo, 'findByEmail', async () => legacyUser);
	const replace = t.mock.method(userRepo, 'replacePasswordHash', async (id, expected, upgraded) => {
		assert.equal(id, 'user');
		assert.equal(expected, legacyHash);
		assert.equal(isLegacyPasswordHash(upgraded), false);
		assert.equal(await verifyPassword(password, upgraded), true);
		return { ...legacyUser, passwordHash: upgraded };
	});
	const session = t.mock.method(sessionRepo, 'create', async (data) => data);
	const result = await login({ email: legacyUser.email, password });
	assert.equal(result.success, true);
	assert.equal(replace.mock.callCount(), 1);
	assert.equal(session.mock.callCount(), 1);
	const sessionData = session.mock.calls[0].arguments[0];
	assert.equal(sessionData.id, generateSessionId(result.sessionToken));
	assert.equal(sessionData.userId, 'user');
	assert.ok(sessionData.expiresAt > new Date());
});

test('wrong passwords cannot upgrade a hash or create a session', async (t) => {
	t.mock.method(userRepo, 'findByEmail', async () => legacyUser);
	const replace = t.mock.method(userRepo, 'replacePasswordHash', async () => undefined);
	const session = t.mock.method(sessionRepo, 'create', async () => undefined);
	assert.deepEqual(await login({ email: legacyUser.email, password: 'wrong password' }), {
		success: false,
		error: 'Invalid email or password'
	});
	assert.equal(replace.mock.callCount(), 0);
	assert.equal(session.mock.callCount(), 0);
});

test('modern hashes authenticate without another upgrade', async (t) => {
	t.mock.method(userRepo, 'findByEmail', async () => ({ ...legacyUser, passwordHash: modernHash }));
	const replace = t.mock.method(userRepo, 'replacePasswordHash', async () => undefined);
	const session = t.mock.method(sessionRepo, 'create', async (data) => data);
	assert.equal((await login({ email: legacyUser.email, password })).success, true);
	assert.equal(
		(await login({ email: legacyUser.email, password: 'wrong password' })).success,
		false
	);
	assert.equal(replace.mock.callCount(), 0);
	assert.equal(session.mock.callCount(), 1);
});

test('parallel legacy upgrades still allow a login with the current password', async (t) => {
	t.mock.method(userRepo, 'findByEmail', async () => legacyUser);
	t.mock.method(userRepo, 'replacePasswordHash', async () => undefined);
	t.mock.method(userRepo, 'findById', async () => ({ ...legacyUser, passwordHash: modernHash }));
	const session = t.mock.method(sessionRepo, 'create', async (data) => data);
	assert.equal((await login({ email: legacyUser.email, password })).success, true);
	assert.equal(session.mock.callCount(), 1);
});

test('an upgrade cannot overwrite a concurrent password change or authenticate the old password', async (t) => {
	const changedHash = await hashPassword(newPassword);
	t.mock.method(userRepo, 'findByEmail', async () => legacyUser);
	t.mock.method(userRepo, 'replacePasswordHash', async () => undefined);
	t.mock.method(userRepo, 'findById', async () => ({ ...legacyUser, passwordHash: changedHash }));
	const session = t.mock.method(sessionRepo, 'create', async () => undefined);
	assert.equal((await login({ email: legacyUser.email, password })).success, false);
	assert.equal(session.mock.callCount(), 0);
});

test('deleting a user during an upgrade cannot create a session', async (t) => {
	t.mock.method(userRepo, 'findByEmail', async () => legacyUser);
	t.mock.method(userRepo, 'replacePasswordHash', async () => undefined);
	t.mock.method(userRepo, 'findById', async () => undefined);
	const session = t.mock.method(sessionRepo, 'create', async () => undefined);
	assert.equal((await login({ email: legacyUser.email, password })).success, false);
	assert.equal(session.mock.callCount(), 0);
});

test('password changes accept existing hashes and store only the new Argon2id password', async (t) => {
	t.mock.method(userRepo, 'findById', async () => legacyUser);
	t.mock.method(userRepo, 'replacePasswordHash', async (id, expected, replacement) => {
		assert.equal(id, legacyUser.id);
		assert.equal(expected, legacyHash);
		assert.equal(await verifyPassword(newPassword, replacement), true);
		assert.equal(await verifyPassword(password, replacement), false);
		return { ...legacyUser, passwordHash: replacement };
	});
	assert.deepEqual(
		await changePassword({ userId: 'user', currentPassword: password, newPassword }),
		{ success: true }
	);
});

test('password changes reject wrong passwords and concurrent replacements', async (t) => {
	t.mock.method(userRepo, 'findById', async () => legacyUser);
	const replace = t.mock.method(userRepo, 'replacePasswordHash', async () => undefined);
	assert.deepEqual(
		await changePassword({ userId: 'user', currentPassword: 'wrong password', newPassword }),
		{ success: false, error: 'Current password is incorrect' }
	);
	assert.equal(replace.mock.callCount(), 0);
	assert.deepEqual(
		await changePassword({ userId: 'user', currentPassword: password, newPassword }),
		{ success: false, error: 'Password changed while updating. Please retry.' }
	);
	assert.equal(replace.mock.callCount(), 1);
});

test('password replacement SQL checks both the user ID and the verified old hash', async (t) => {
	t.mock.method(db, 'update', (table) => {
		assert.equal(table, userTable);
		return {
			set: (data) => {
				assert.equal(data.passwordHash, modernHash);
				return {
					where: (condition) => {
						const query = new PgDialect().sqlToQuery(condition);
						assert.deepEqual(query.params, ['user', legacyHash]);
						assert.match(query.sql, /"user"\."password_hash"/);
						return { returning: async () => [] };
					}
				};
			}
		};
	});
	assert.equal(await userRepo.replacePasswordHash('user', legacyHash, modernHash), undefined);
});
