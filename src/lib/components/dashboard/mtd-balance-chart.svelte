<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';

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

	const CHART_WIDTH = 920;
	const CHART_HEIGHT = 260;
	const CHART_PADDING = {
		top: 16,
		right: 24,
		bottom: 34,
		left: 64
	};

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

		const monthDeltaByAccount = new Map<string, number>();
		const dailyDeltaByDateAndAccount = new Map<string, Map<string, number>>();

		function applyDelta(dayKey: string, accountId: string | null, delta: number) {
			if (!accountId || !accountIds.has(accountId)) return;

			monthDeltaByAccount.set(accountId, (monthDeltaByAccount.get(accountId) ?? 0) + delta);

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

	let chartBounds = $derived.by(() => {
		if (accounts.length === 0 || monthToDateBalancePoints.length === 0) {
			return { min: -100, max: 100 };
		}

		let minValue = Number.POSITIVE_INFINITY;
		let maxValue = Number.NEGATIVE_INFINITY;

		for (const point of monthToDateBalancePoints) {
			for (const account of accounts) {
				const value = point.balances[account.id] ?? 0;
				minValue = Math.min(minValue, value);
				maxValue = Math.max(maxValue, value);
			}
		}

		if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
			return { min: -100, max: 100 };
		}

		if (minValue === maxValue) {
			const offset = Math.max(Math.abs(minValue) * 0.05, 10000);
			return { min: minValue - offset, max: maxValue + offset };
		}

		const padding = Math.max((maxValue - minValue) * 0.1, 5000);
		return { min: minValue - padding, max: maxValue + padding };
	});

	let chartTicks = $derived.by(() => {
		const tickCount = 5;
		const step = (chartBounds.max - chartBounds.min) / (tickCount - 1);
		return Array.from({ length: tickCount }, (_, index) => chartBounds.min + step * index);
	});

	function getChartX(index: number, total: number): number {
		if (total <= 1) return CHART_PADDING.left;
		const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
		return CHART_PADDING.left + (index / (total - 1)) * plotWidth;
	}

	function getChartY(value: number, min: number, max: number): number {
		if (max <= min) return CHART_HEIGHT / 2;
		const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
		const ratio = (value - min) / (max - min);
		return CHART_HEIGHT - CHART_PADDING.bottom - ratio * plotHeight;
	}

	let hoveredDayIndex = $state<number | null>(null);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Balance Overview</Card.Title>
		<Card.Description>End-of-day balance for each account in {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			<div
				class="relative h-[280px] w-full"
				role="presentation"
				onmouseleave={() => (hoveredDayIndex = null)}
			>
				<svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" class="h-full w-full">
					{#each chartTicks as tick (tick)}
						{@const y = getChartY(tick, chartBounds.min, chartBounds.max)}
						<line
							x1={CHART_PADDING.left}
							y1={y}
							x2={CHART_WIDTH - CHART_PADDING.right}
							y2={y}
							class="stroke-border/50"
							stroke-width="1"
						/>
						<text
							x={CHART_PADDING.left - 8}
							y={y + 4}
							text-anchor="end"
							class="fill-muted-foreground text-[10px]"
						>
							{formatCurrency(Math.round(tick))}
						</text>
					{/each}

					{#each accounts as account (account.id)}
						{@const pathData = monthToDateBalancePoints
							.map((point, index) => {
								const x = getChartX(index, monthToDateBalancePoints.length);
								const y = getChartY(
									point.balances[account.id] ?? 0,
									chartBounds.min,
									chartBounds.max
								);
								return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
							})
							.join(' ')}
						<path
							d={pathData}
							fill="none"
							stroke={account.color}
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>

						{#if hoveredDayIndex !== null && monthToDateBalancePoints[hoveredDayIndex]}
							{@const hoveredPoint = monthToDateBalancePoints[hoveredDayIndex]}
							<circle
								cx={getChartX(hoveredDayIndex, monthToDateBalancePoints.length)}
								cy={getChartY(
									hoveredPoint.balances[account.id] ?? 0,
									chartBounds.min,
									chartBounds.max
								)}
								r="3.5"
								fill={account.color}
							/>
						{/if}
					{/each}

					{#each monthToDateBalancePoints as point, index (point.dateKey)}
						{#if index === 0 || index === monthToDateBalancePoints.length - 1 || index % 5 === 0}
							<text
								x={getChartX(index, monthToDateBalancePoints.length)}
								y={CHART_HEIGHT - 10}
								text-anchor="middle"
								class="fill-muted-foreground text-[10px]"
							>
								{new Date(point.date).getDate()}
							</text>
						{/if}
					{/each}
				</svg>

				<div class="absolute inset-0">
					<div class="flex h-full w-full">
						{#each monthToDateBalancePoints as point, index (point.dateKey)}
							<button
								type="button"
								class="h-full flex-1 cursor-default border-none bg-transparent p-0"
								onmouseenter={() => {
									hoveredDayIndex = index;
								}}
								onfocus={() => {
									hoveredDayIndex = index;
								}}
								aria-label="Show balances for {point.label}"
							></button>
						{/each}
					</div>
				</div>

				{#if hoveredDayIndex !== null && monthToDateBalancePoints[hoveredDayIndex]}
					{@const hoveredPoint = monthToDateBalancePoints[hoveredDayIndex]}
					<div
						class="pointer-events-none absolute top-2 right-2 w-56 rounded-md border bg-popover p-3 text-xs shadow-md"
					>
						<div class="mb-2 font-semibold text-popover-foreground">{hoveredPoint.label}</div>
						<div class="space-y-1">
							{#each accounts as account (account.id)}
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-2 w-2 rounded-full"
											style="background-color: {account.color}"
										></span>
										<span class="text-muted-foreground">{account.name}</span>
									</div>
									<span class="font-medium text-popover-foreground">
										{formatCurrency(hoveredPoint.balances[account.id] ?? 0)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

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
