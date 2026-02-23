<script lang="ts">
	import { LineChart } from 'layerchart';
	import { scaleUtc } from 'd3-scale';
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
		selectedMonth = new Date().getUTCMonth(),
		selectedYear = new Date().getUTCFullYear()
	}: {
		accounts: ChartAccount[];
		transactions: ChartTransaction[];
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

		const monthStart = new Date(Date.UTC(selectedYear, selectedMonth, 1));
		const monthEnd = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999));
		const accountIds = new Set(accounts.map((account) => account.id));

		const dailyDeltaByDateAndAccount = new Map<string, Map<string, number>>();

		function applyDelta(dayKey: string, accountId: string | null, delta: number) {
			if (!accountId || !accountIds.has(accountId)) return;

			const dayDeltaMap = dailyDeltaByDateAndAccount.get(dayKey) ?? new Map<string, number>();
			dayDeltaMap.set(accountId, (dayDeltaMap.get(accountId) ?? 0) + delta);
			dailyDeltaByDateAndAccount.set(dayKey, dayDeltaMap);
		}

		for (const tx of transactions) {
			if (tx.deletedAt !== null) continue;

			const txDate = new Date(tx.createdAt);
			if (txDate < monthStart || txDate > monthEnd) continue;

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
		const runningBalanceByAccount = new Map<string, number>();
		for (const account of accounts) {
			// To get the balance at the start of the month, we need to subtract all transactions 
			// that happened AFTER the start of the month from the current balance.
			let deltaSinceMonthStart = 0;
			for (const tx of transactions) {
				if (tx.deletedAt !== null) continue;
				const txDate = new Date(tx.createdAt);
				if (txDate >= monthStart) {
					if (tx.accountId === account.id) {
						if (tx.type === 'income') deltaSinceMonthStart += tx.amount;
						else deltaSinceMonthStart -= tx.amount;
					}
					if (tx.toAccountId === account.id && tx.type === 'transfer') {
						deltaSinceMonthStart += tx.amount;
					}
				}
			}
			runningBalanceByAccount.set(account.id, account.currentBalance - deltaSinceMonthStart);
		}

		const points: MonthToDateBalancePoint[] = [];
		let cursor = new Date(monthStart);

		while (cursor <= monthEnd) {
			const dayDate = new Date(cursor);
			const dayKey = toLocalDateKey(dayDate);
			const dayDeltaMap = dailyDeltaByDateAndAccount.get(dayKey);

			const balances: Record<string, number> = {};
			for (const account of accounts) {
				const currentBalance = runningBalanceByAccount.get(account.id) ?? account.currentBalance;
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

			cursor = new Date(cursor);
			cursor.setDate(cursor.getDate() + 1);
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
		<Card.Description>End-of-day balance for each account in {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			<Chart.Container config={chartConfig} class="h-[280px] w-full">
				<LineChart
					data={chartData}
					x="date"
					xScale={scaleUtc()}
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
