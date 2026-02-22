<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		value?: string; // "HH:mm"
		class?: string;
	}

	let { value = $bindable('12:00'), class: className }: Props = $props();

	let hours = $derived(value.split(':')[0]);
	let minutes = $derived(value.split(':')[1]);

	function updateTime(newHours: number, newMinutes: number) {
		const h = Math.max(0, Math.min(23, newHours)).toString().padStart(2, '0');
		const m = Math.max(0, Math.min(59, newMinutes)).toString().padStart(2, '0');
		value = `${h}:${m}`;
	}

	function handleKeydown(e: KeyboardEvent, type: 'hours' | 'minutes') {
		const hNum = parseInt(hours);
		const mNum = parseInt(minutes);

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (type === 'hours') updateTime(hNum + 1, mNum);
			else updateTime(hNum, mNum + 1);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (type === 'hours') updateTime(hNum - 1, mNum);
			else updateTime(hNum, mNum - 1);
		} else if (/^\d$/.test(e.key)) {
			// Handle number typing
			const num = parseInt(e.key);
			if (type === 'hours') {
				// If first digit is > 2, it's the only digit. If < 2, could be 10-23
				// Simple logic: if current is 0, set to num. If current is 1 or 2, append.
				if (hNum === 0 || hNum > 2) updateTime(num, mNum);
				else {
					const next = parseInt(`${hNum}${num}`);
					updateTime(next > 23 ? num : next, mNum);
				}
			} else {
				// Minutes logic: if current is 0 or > 5, set to num. Else append.
				if (mNum === 0 || mNum > 5) updateTime(hNum, num);
				else {
					const next = parseInt(`${mNum}${num}`);
					updateTime(hNum, next > 59 ? num : next);
				}
			}
		}
	}

	function handleWheel(e: WheelEvent, type: 'hours' | 'minutes') {
		e.preventDefault();
		const hNum = parseInt(hours);
		const mNum = parseInt(minutes);
		const delta = e.deltaY < 0 ? 1 : -1;

		if (type === 'hours') updateTime(hNum + delta, mNum);
		else updateTime(hNum, mNum + delta);
	}
</script>

<div
	class={cn(
		'inline-flex items-center gap-0.5 rounded-md border border-border/20 bg-background/50 px-1.5 py-0.5 font-mono text-xs shadow-sm transition-colors select-none hover:border-border/40',
		className
	)}
>
	<div
		role="button"
		tabindex="0"
		class="cursor-default rounded px-1 py-0.5 transition-colors hover:bg-muted focus:bg-primary focus:text-primary-foreground focus:outline-none"
		onkeydown={(e) => handleKeydown(e, 'hours')}
		onwheel={(e) => handleWheel(e, 'hours')}
	>
		{hours}
	</div>
	<span class="text-muted-foreground/50">:</span>
	<div
		role="button"
		tabindex="0"
		class="cursor-default rounded px-1 py-0.5 transition-colors hover:bg-muted focus:bg-primary focus:text-primary-foreground focus:outline-none"
		onkeydown={(e) => handleKeydown(e, 'minutes')}
		onwheel={(e) => handleWheel(e, 'minutes')}
	>
		{minutes}
	</div>
</div>
