import { getContext, setContext } from 'svelte';

export const DASHBOARD_MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
] as const;

const DASHBOARD_PERIOD_CONTEXT_KEY = Symbol('dashboard-period');

export type DashboardPeriodContext = {
	month: number;
	year: number;
	currentMonth: number;
	currentYear: number;
};

export function createDashboardYears(currentYear: number) {
	return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
}

export function setDashboardPeriodContext(value: DashboardPeriodContext) {
	return setContext(DASHBOARD_PERIOD_CONTEXT_KEY, value);
}

export function getDashboardPeriodContext() {
	return getContext<DashboardPeriodContext>(DASHBOARD_PERIOD_CONTEXT_KEY);
}
