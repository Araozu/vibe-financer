<script lang="ts">
	import { SvelteMap, SvelteDate, SvelteSet } from 'svelte/reactivity';
	import { LineChart } from 'layerchart';
	import { scaleTime } from 'd3-scale';
	import { curveNatural } from 'd3-shape';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { DEFAULT_CURRENCY_SYMBOL } from '$lib/domain/currency';

	type ChartAccount = {
		id: string;
		name: string;
		color: string;
		currentBalance: number;
		currencySymbol?: string | null;
	};

	type ChartTransaction = {
		accountId: string;
		toAccountId: string | null;
		type: 'income' | 'expense' | 'transfer';
		amount: number;
		createdAt: string;
		deletedAt: string | null;
	};

	type MonthToDateBalancePoint = {
		date: Date;
		dateKey: string;
		label: string;
		balances: Record<string, number>;
	};

	let {
		accounts,
		transactions,
		initialBalances = {},
		selectedMonth = new Date().getUTCMonth(),
		selectedYear = new Date().getUTCFullYear()
	}: {
		accounts: ChartAccount[];
		transactions: ChartTransaction[];
		initialBalances?: Record<string, number>;
		selectedMonth?: number;
		selectedYear?: number;
	} = $props();

	let activeAccountIds = $state(new SvelteSet(accounts.map((a) => a.id)));

	function toggleAccount(accountId: string) {
		if (activeAccountIds.has(accountId)) {
			activeAccountIds.delete(accountId);
		} else {
			activeAccountIds.add(accountId);
		}
	}

	function resetAccounts() {
		for (const account of accounts) {
			activeAccountIds.add(account.id);
		}
	}

	function toLocalDateKey(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatChartDateLabel(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatNumber(amountInCents: number): string {
		return (amountInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	let monthToDateBalancePoints = $derived.by(() => {
		if (accounts.length === 0) {
			return [] as MonthToDateBalancePoint[];
		}

		// Use local dates for start and end of month
		const monthStart = new Date(selectedYear, selectedMonth, 1);
		const monthEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
		const accountIds = new Set(accounts.map((account) => account.id));

		const dailyDeltaByDateAndAccount = new SvelteMap<string, SvelteMap<string, number>>();

		function applyDelta(dayKey: string, accountId: string | null, delta: number) {
			if (!accountId || !accountIds.has(accountId)) return;

			let dayDeltaMap = dailyDeltaByDateAndAccount.get(dayKey);
			if (!dayDeltaMap) {
				dayDeltaMap = new SvelteMap<string, number>();
				dailyDeltaByDateAndAccount.set(dayKey, dayDeltaMap);
			}
			dayDeltaMap.set(accountId, (dayDeltaMap.get(accountId) ?? 0) + delta);
		}

		for (const tx of transactions) {
			if (tx.deletedAt !== null) continue;

			const txDate = new Date(tx.createdAt);
			const dayKey = toLocalDateKey(txDate);

			if (tx.type === 'income') {
				applyDelta(dayKey, tx.accountId, tx.amount);
				continue;
			}

			if (tx.type === 'transfer') {
				applyDelta(dayKey, tx.accountId, -tx.amount);
				applyDelta(dayKey, tx.toAccountId, tx.amount);
				continue;
			}

			applyDelta(dayKey, tx.accountId, -tx.amount);
		}

		// Calculate balance at the start of the selected month
		const runningBalanceByAccount = new SvelteMap<string, number>();
		for (const account of accounts) {
			// Use the initial balance provided by the server
			runningBalanceByAccount.set(account.id, initialBalances[account.id] ?? 0);
		}

		const points: MonthToDateBalancePoint[] = [];
		let cursorDate = new SvelteDate(monthStart);

		while (cursorDate <= monthEnd) {
			const dayDate = new Date(cursorDate);
			const dayKey = toLocalDateKey(dayDate);
			const dayDeltaMap = dailyDeltaByDateAndAccount.get(dayKey);

			const balances: Record<string, number> = {};
			for (const account of accounts) {
				const currentBalance = runningBalanceByAccount.get(account.id) ?? 0;
				const dayDelta = dayDeltaMap?.get(account.id) ?? 0;
				const endOfDayBalance = currentBalance + dayDelta;
				runningBalanceByAccount.set(account.id, endOfDayBalance);
				balances[account.id] = endOfDayBalance;
			}

			points.push({
				date: dayDate,
				dateKey: dayKey,
				label: formatChartDateLabel(dayDate),
				balances
			});

			cursorDate = new SvelteDate(cursorDate);
			cursorDate.setDate(cursorDate.getDate() + 1);
		}

		return points;
	});

	let chartData = $derived.by(() =>
		monthToDateBalancePoints.map((point) => ({
			date: point.date,
			...point.balances
		}))
	);

	let chartConfig = $derived.by(() =>
		accounts.reduce<Chart.ChartConfig>((config, account) => {
			config[account.id] = {
				label: account.name,
				color: account.color
			};
			return config;
		}, {})
	);

	let chartSeries = $derived.by(() =>
		accounts
			.filter((account) => activeAccountIds.has(account.id))
			.map((account) => ({
				key: account.id,
				label: `${account.name} (${account.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL})`,
				color: account.color
			}))
	);

	function formatDayTick(date: Date): string {
		const day = date.getDate();
		const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
		if (day === 1 || day === lastDay || day % 5 === 0) {
			return `${day}`;
		}
		return '';
	}

	const chartPadding = {
		top: 16,
		right: 16,
		bottom: 34,
		left: 56
	};
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Balance Overview</Card.Title>
		<Card.Description
			>End-of-day balance for each account in {new Date(
				selectedYear,
				selectedMonth
			).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Card.Description
		>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			<Chart.Container config={chartConfig} class="h-[280px] w-full">
				<LineChart
					data={chartData}
					x="date"
					xScale={scaleTime()}
					padding={chartPadding}
					axis={true}
					series={chartSeries}
					props={{
						spline: { curve: curveNatural, motion: 'tween', strokeWidth: 2.5 },
						xAxis: {
							format: (value: Date) => formatDayTick(value)
						},
						yAxis: {
							ticks: 5,
							format: (value: number) => formatNumber(Math.round(value))
						},
						tooltip: {
							header: {
								format: (value: Date) => formatChartDateLabel(value)
							},
							item: {
								format: (value: number) => formatNumber(value)
							}
						},
						highlight: { points: { r: 3.5 } }
					}}
				/>
			</Chart.Container>

			<div class="flex flex-wrap items-center gap-2">
				{#each accounts as account (account.id)}
					{@const isActive = activeAccountIds.has(account.id)}
					<button
						type="button"
						onclick={() => toggleAccount(account.id)}
						class={[
							'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:bg-muted',
							isActive
								? 'border-transparent bg-secondary text-secondary-foreground shadow-sm'
								: 'border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground opacity-60'
						]}
					>
						<span
							class="inline-block h-2 w-2 rounded-full transition-transform"
							style="background-color: {account.color}; transform: scale({isActive ? 1 : 0.8})"
						></span>
						{account.name}
					</button>
				{/each}

				{#if activeAccountIds.size < accounts.length}
					<button
						type="button"
						onclick={resetAccounts}
						class="ml-auto text-xs font-medium text-primary hover:underline"
					>
						Reset
					</button>
				{/if}
			</div>
		</div>
	</Card.Content>
</Card.Root>
