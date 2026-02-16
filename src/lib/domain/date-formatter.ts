/**
 * Pure date formatting functions for displaying dates in local timezone
 * All functions are timezone-aware and locale-specific
 */

/**
 * Normalizes a date to UTC-0.
 * If input is a string, it parses it.
 * If input is a Date, it returns a new Date with the same timestamp but conceptually UTC.
 * Actually, JS Dates are always UTC internally, but this ensures we treat them as such.
 */
export function toUTC(date: Date | string | number): Date {
	const d = new Date(date);
	return new Date(d.getTime());
}

/**
 * Normalizes a date string (like "2026-02-16") to a UTC-0 Date object.
 * This avoids the local timezone shift when parsing date-only strings.
 */
export function parseDateAsUTC(dateStr: string): Date {
	// If it's already an ISO string with Z or offset, new Date() is fine
	if (dateStr.includes('T') || dateStr.includes('Z')) {
		return toUTC(dateStr);
	}
	// If it's just YYYY-MM-DD, append T00:00:00Z to force UTC
	return new Date(`${dateStr}T00:00:00Z`);
}

/**
 * Format a UTC date string to local date (respecting user's timezone)
 * Uses the browser's local timezone automatically
 */
export function formatLocalDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Format a UTC date string to local date and time (respecting user's timezone)
 */
export function formatLocalDateTime(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format a UTC date string to relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) return 'just now';
	if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
	if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
	if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
	
	// If older than a week, show actual date
	return formatLocalDate(dateString);
}

/**
 * Format just the time portion in local timezone
 */
export function formatLocalTime(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit'
	});
}