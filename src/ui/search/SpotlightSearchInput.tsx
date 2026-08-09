import type { RefObject } from "react";

interface SpotlightSearchInputProps {
	readonly ariaLabel: string;
	readonly inputRef: RefObject<HTMLInputElement | null>;
	readonly onEnter: () => void;
	readonly onQueryChange: (query: string) => void;
	readonly onSelectedIndexChange: (index: number) => void;
	readonly placeholder?: string;
	readonly query: string;
	readonly resultCount: number;
	readonly selectedIndex: number;
}

/** Shares the compact spotlight search field and result-keyboard navigation. */
export const SpotlightSearchInput = ({
	ariaLabel,
	inputRef,
	onEnter,
	onQueryChange,
	onSelectedIndexChange,
	placeholder = "Search item title or ID…",
	query,
	resultCount,
	selectedIndex,
}: SpotlightSearchInputProps) => (
	<input
		aria-label={ariaLabel}
		className="w-full rounded-lg border border-line-strong bg-surface px-4 py-3 text-base text-foreground outline-none"
		placeholder={placeholder}
		ref={inputRef}
		type="search"
		value={query}
		onChange={(event) => onQueryChange(event.currentTarget.value)}
		onKeyDown={(event) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				onSelectedIndexChange(resultCount === 0 ? 0 : (selectedIndex + 1) % resultCount);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				onSelectedIndexChange(
					resultCount === 0 ? 0 : (selectedIndex - 1 + resultCount) % resultCount,
				);
				return;
			}
			if (event.key === "Enter") {
				event.preventDefault();
				onEnter();
			}
		}}
	/>
);
