import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64, encodeHexLowerCase } from '@oslojs/encoding';

/**
 * Hash a password using SHA-256
 * @param password - Plain text password
 * @returns Hashed password as hex string
 */
export function hashPassword(password: string): string {
	const passwordBytes = new TextEncoder().encode(password);
	const hash = sha256(passwordBytes);
	return encodeHexLowerCase(hash);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored password hash
 * @returns True if password matches hash
 */
export function verifyPassword(password: string, hash: string): boolean {
	return hashPassword(password) === hash;
}

/**
 * Generate a random session token
 * @returns Base64 encoded session token
 */
export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	return encodeBase64(bytes);
}

/**
 * Generate session ID from token
 * @param token - Session token
 * @returns Session ID as hex string
 */
export function generateSessionId(token: string): string {
	const tokenBytes = new TextEncoder().encode(token);
	const hash = sha256(tokenBytes);
	return encodeHexLowerCase(hash);
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns True if email is valid
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Error message if invalid, null if valid
 */
export function validatePassword(password: string): string | null {
	if (password.length < 8) {
		return 'Password must be at least 8 characters long';
	}
	return null;
}
