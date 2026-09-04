import type { RefObject } from "react";

import { SearchInput } from "~/ui/ui/SearchInput";

interface SpotlightSearchInputProps {
	readonly inputRef: RefObject<HTMLInputElement | null>;
	readonly onEnterFn: () => void;
	readonly onQueryChangeFn: (query: string) => void;
	readonly onSelectedIndexChangeFn: (index: number) => void;
	readonly placeholder?: string;
	readonly query: string;
	readonly resultCount: number;
	readonly selectedIndex: number;
}

/** Shares the compact spotlight search field and result-keyboard navigation. */
export const SpotlightSearchInput = ({
	inputRef,
	onEnterFn,
	onQueryChangeFn,
	onSelectedIndexChangeFn,
	placeholder = "Search item title or ID…",
	query,
	resultCount,
	selectedIndex,
}: SpotlightSearchInputProps) => (
	<SearchInput
		className="w-full rounded-lg border border-line-strong bg-surface px-4 py-3 text-base text-foreground outline-none"
		placeholder={placeholder}
		ref={inputRef}
		value={query}
		onValueChangeFn={onQueryChangeFn}
		onKeyDown={(event) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				onSelectedIndexChangeFn(resultCount === 0 ? 0 : (selectedIndex + 1) % resultCount);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				onSelectedIndexChangeFn(
					resultCount === 0 ? 0 : (selectedIndex - 1 + resultCount) % resultCount,
				);
				return;
			}
			if (event.key === "Enter") {
				event.preventDefault();
				onEnterFn();
			}
		}}
	/>
);
