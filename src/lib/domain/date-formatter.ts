import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';

/**
 * Pure date formatting functions for displaying dates in local timezone
 * All functions are timezone-aware and locale-specific
 */

/**
 * Normalizes a date to a Date object.
 * If input is a string, it parses it using parseISO to handle offsets correctly.
 */
export function toDateObject(date: Date | string | number): Date {
	if (date instanceof Date) return date;
	if (typeof date === 'string') return parseISO(date);
	return new Date(date);
}

/**
 * Converts a Date to a full ISO 8601 string with timezone offset.
 * This preserves the exact moment and the local context.
 */
export function toISOWithOffset(date: Date | string | number): string {
	const d = toDateObject(date);
	// date-fns format with 'xxx' gives the ISO offset (e.g. -05:00)
	return format(d, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

/**
 * Normalizes a date to UTC.
 */
export function toUTC(date: Date | string | number): Date {
	const d = toDateObject(date);
	return toDate(d, { timeZone: 'UTC' });
}

/**
 * Parses a date string as UTC.
 */
export function parseDateAsUTC(dateStr: string): Date {
	if (dateStr.includes('T')) {
		return toUTC(parseISO(dateStr));
	}
	return toUTC(new Date(dateStr + 'T00:00:00Z'));
}

/**
 * Normalizes a date string (like "2026-02-16") to a Date object at local midnight.
 * This avoids the local timezone shift when parsing date-only strings.
 */
export function parseDateLocal(dateStr: string): Date {
	// If it's already an ISO string with T, parse it normally
	if (dateStr.includes('T')) {
		return parseISO(dateStr);
	}
	// If it's just YYYY-MM-DD, parse as local midnight
	return new Date(dateStr + 'T00:00:00');
}

/**
 * Format a date to local date string (respecting user's timezone)
 */
export function formatLocalDate(date: Date | string | number): string {
	const d = toDateObject(date);
	return format(d, 'MMM d, yyyy');
}

/**
 * Format a date to local date and time string
 */
export function formatLocalDateTime(date: Date | string | number): string {
	const d = toDateObject(date);
	return format(d, 'MMM d, yyyy, h:mm a');
}

/**
 * Format a date to relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(date: Date | string | number): string {
	const d = toDateObject(date);
	return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Format just the time portion in local timezone
 */
export function formatLocalTime(date: Date | string | number): string {
	const d = toDateObject(date);
	return format(d, 'HH:mm');
}

/**
 * Time-travel helper: get a date at a specific timezone
 */
export function formatInTZ(
	date: Date | string | number,
	tz: string,
	fmt: string = 'yyyy-MM-dd HH:mm:ssxxx'
): string {
	const d = toDateObject(date);
	return formatInTimeZone(d, tz, fmt);
}
