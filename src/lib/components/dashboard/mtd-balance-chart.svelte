<script lang="ts">
	import { SvelteMap, SvelteDate } from 'svelte/reactivity';
	import { LineChart } from 'layerchart';
	import { scaleTime } from 'd3-scale';
	import { curveNatural } from 'd3-shape';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';

	type ChartAccount = {
		id: string;
		name: string;
		color: string;
		currentBalance: number;
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

	function toLocalDateKey(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatChartDateLabel(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatCurrency(amountInCents: number): string {
		return (amountInCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
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
		accounts.map((account) => ({
			key: account.id,
			label: account.name,
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
							format: (value: number) => formatCurrency(Math.round(value))
						},
						tooltip: {
							header: {
								format: (value: Date) => formatChartDateLabel(value)
							},
							item: {
								format: (value: number) => formatCurrency(value)
							}
						},
						highlight: { points: { r: 3.5 } }
					}}
				/>
			</Chart.Container>

			<div class="flex flex-wrap gap-3">
				{#each accounts as account (account.id)}
					<div class="flex items-center gap-2 text-xs">
						<span
							class="inline-block h-2 w-2 rounded-full"
							style="background-color: {account.color}"
						></span>
						<span class="text-muted-foreground">{account.name}</span>
					</div>
				{/each}
			</div>
		</div>
	</Card.Content>
</Card.Root>
