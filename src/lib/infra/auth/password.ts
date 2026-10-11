import { argon2, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// OWASP's Argon2id minimum: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
const ARGON2_PARAMETERS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
const ARGON2_PREFIX = '$argon2id$v=19$m=19456,t=2,p=1$';
const ARGON2_HASH_PATTERN =
	/^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/;

function derivePasswordHash(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		argon2(
			'argon2id',
			{ ...ARGON2_PARAMETERS, message: Buffer.from(password, 'utf8'), nonce: salt },
			(err, hash) => {
				if (err) reject(err);
				else resolve(hash);
			}
		);
	});
}

function encodeHashPart(value: Buffer): string {
	return value.toString('base64').replace(/=+$/, '');
}

/** Store a salted Argon2id hash in the standard PHC format. */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await derivePasswordHash(password, salt);
	return `${ARGON2_PREFIX}${encodeHashPart(salt)}$${encodeHashPart(hash)}`;
}

export function isLegacyPasswordHash(hash: string): boolean {
	return hash.length === 64 && /^[a-f0-9]{64}$/.test(hash);
}

/** Verify legacy hashes for compatibility; new writes always use Argon2id. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	if (isLegacyPasswordHash(hash)) {
		const expected = Buffer.from(hash, 'hex');
		const actual = createHash('sha256').update(password, 'utf8').digest();
		return timingSafeEqual(actual, expected);
	}

	// Only accept the supported profile; stored parameters cannot request unbounded work.
	const match = ARGON2_HASH_PATTERN.exec(hash);
	if (!match || match[0] !== hash) return false;
	const salt = Buffer.from(match[1], 'base64');
	const expected = Buffer.from(match[2], 'base64');
	if (encodeHashPart(salt) !== match[1] || encodeHashPart(expected) !== match[2]) return false;
	const actual = await derivePasswordHash(password, salt);
	return timingSafeEqual(actual, expected);
}
