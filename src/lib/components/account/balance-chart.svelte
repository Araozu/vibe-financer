<script lang="ts">
	import { line as d3Line, curveMonotoneX } from 'd3-shape';

	type ChartDataPoint = {
		date: string;
		balance: number;
	};

	let {
		data,
		color = '#3b82f6',
		currencySymbol = '$'
	}: {
		data: ChartDataPoint[];
		color?: string;
		currencySymbol?: string;
	} = $props();

	const CHART_WIDTH = 920;
	const CHART_HEIGHT = 260;
	const CHART_PADDING = {
		top: 16,
		right: 24,
		bottom: 34,
		left: 64
	};

	function formatCurrency(amountInCents: number): string {
		return `${currencySymbol}${(amountInCents / 100).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		})}`;
	}

	let parsedData = $derived(
		data.map((d) => ({
			date: new Date(d.date),
			balance: d.balance
		}))
	);

	let chartBounds = $derived.by(() => {
		if (parsedData.length === 0) {
			return { min: -100, max: 100 };
		}

		let minValue = Number.POSITIVE_INFINITY;
		let maxValue = Number.NEGATIVE_INFINITY;

		for (const point of parsedData) {
			minValue = Math.min(minValue, point.balance);
			maxValue = Math.max(maxValue, point.balance);
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

	let hoveredIndex = $state<number | null>(null);

	let pathData = $derived.by(() => {
		if (parsedData.length === 0) return '';
		const lineGen = d3Line<{ date: Date; balance: number }>()
			.x((_, i) => getChartX(i, parsedData.length))
			.y((d) => getChartY(d.balance, chartBounds.min, chartBounds.max))
			.curve(curveMonotoneX);
		return lineGen(parsedData) ?? '';
	});
</script>

<div class="space-y-4">
	<div
		class="relative h-[280px] w-full"
		role="presentation"
		onmouseleave={() => (hoveredIndex = null)}
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

			<path
				d={pathData}
				fill="none"
				stroke={color}
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>

			{#if hoveredIndex !== null && parsedData[hoveredIndex]}
				{@const hoveredPoint = parsedData[hoveredIndex]}
				<circle
					cx={getChartX(hoveredIndex, parsedData.length)}
					cy={getChartY(hoveredPoint.balance, chartBounds.min, chartBounds.max)}
					r="3.5"
					fill={color}
				/>
			{/if}

			{#each parsedData as point, index (point.date.toISOString())}
				{#if index === 0 || index === parsedData.length - 1 || index % 5 === 0}
					<text
						x={getChartX(index, parsedData.length)}
						y={CHART_HEIGHT - 10}
						text-anchor="middle"
						class="fill-muted-foreground text-[10px]"
					>
						{point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
					</text>
				{/if}
			{/each}
		</svg>

		<div class="absolute inset-0">
			<div class="flex h-full w-full">
				{#each parsedData as point, index (point.date.toISOString())}
					<button
						type="button"
						class="h-full flex-1 cursor-default border-none bg-transparent p-0"
						onmouseenter={() => {
							hoveredIndex = index;
						}}
						onfocus={() => {
							hoveredIndex = index;
						}}
						aria-label="Show balance for {point.date.toLocaleDateString()}"
					></button>
				{/each}
			</div>
		</div>

		{#if hoveredIndex !== null && parsedData[hoveredIndex]}
			{@const hoveredPoint = parsedData[hoveredIndex]}
			{@const tooltipX = getChartX(hoveredIndex, parsedData.length)}
			{@const tooltipY = getChartY(hoveredPoint.balance, chartBounds.min, chartBounds.max)}
			<div
				class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-foreground px-3 py-2 text-center text-xs shadow-lg"
				style="left: {(tooltipX / CHART_WIDTH) * 100}%; top: {(tooltipY / CHART_HEIGHT) * 100 - 4}%"
			>
				<div class="text-[10px] text-background/70">
					{hoveredPoint.date.toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})}
				</div>
				<div class="font-bold text-background">
					{formatCurrency(hoveredPoint.balance)}
				</div>
			</div>
		{/if}
	</div>
</div>
