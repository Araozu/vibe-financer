# Skeuomorphic Design Guide 🎨✨

This project uses a "quiet luxury" skeuomorphic style for interactive elements like buttons and select triggers. It's designed to feel tactile and premium without being overwhelming.

## The "Sweet Spot" Values

### 1. Light Theme ☀️

- **Background**: `bg-linear-to-b from-background to-accent/10`
- **Top Highlight**: `shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset]` (catches the light at the top edge)
- **Drop Shadow**: `0_1px_2px_rgba(0,0,0,0.1)` (gives it a tiny bit of "lift")
- **Hover**: `hover:to-accent/20`
- **Active State**: `active:translate-y-[1px] active:shadow-inner` (feels like a physical press)

### 2. Dark Theme 🌙

- **Background**: `dark:from-muted/15 dark:to-muted/5`
- **Top Highlight**: `dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]` (subtle matte finish highlight)
- **Drop Shadow**: `0_1.5px_3px_rgba(0,0,0,0.3)` (deeper shadows for better contrast in dark mode)
- **Active State**: `active:translate-y-[1px] active:shadow-inner`

## Implementation Example (Tailwind)

```html
<button
	class="/* Base Shape & Typography */ /* Light Theme Skeuomorph */ /* Dark Theme Skeuomorph */ /* Interactions */ h-8 rounded-md border border-border/40 bg-linear-to-b from-background to-accent/10 px-2.5 py-1.5 text-xs font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(0,0,0,0.1)] transition-all hover:to-accent/20 active:translate-y-px active:shadow-inner dark:from-muted/15 dark:to-muted/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_1.5px_3px_rgba(0,0,0,0.3)] dark:hover:to-muted/10"
>
	Click Me 💅
</button>
```

## Why it works

- **Tactile Feedback**: The combination of the top highlight and the bottom shadow creates a 3D effect.
- **Micro-interactions**: The `translate-y-[1px]` on active state mimics the physical travel of a button.
- **Subtlety**: We use very low opacity values for the highlights and shadows to keep it modern and chic.

Stay snatched! 🎀🏽
