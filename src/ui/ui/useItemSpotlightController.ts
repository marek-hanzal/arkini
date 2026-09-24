import {
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";
import { useFuseSearch } from "~/ui/ui/useFuseSearch";

export namespace useItemSpotlightController {
	export interface Option {
		readonly artwork: ReactNode;
		readonly disabled?: boolean;
		readonly disabledReason?: ReactNode;
		readonly itemUid: string;
		readonly label: string;
		readonly secondary?: string;
		readonly terms: ReadonlyArray<string>;
		readonly identityTerms?: ReadonlyArray<string>;
		readonly descriptionTerms?: ReadonlyArray<string>;
		readonly keywordTerms?: ReadonlyArray<string>;
	}

	export interface Props {
		readonly onCloseFn: () => void;
		readonly onQueryChangeFn?: (query: string) => void;
		readonly onSelectItemFn: (itemUid: string) => void;
		readonly options: ReadonlyArray<Option>;
		readonly resultLimit?: number;
	}

	export interface SelectItemProps {
		readonly index: number;
		readonly itemUid: string;
	}

	export interface Output {
		readonly inputRef: RefObject<HTMLInputElement | null>;
		readonly resultsRef: RefObject<HTMLDivElement | null>;
		readonly navigateSelectionFn: (index: number) => void;
		readonly onKeyDownFn: (event: KeyboardEvent<HTMLDivElement>) => void;
		readonly query: string;
		readonly searchPending: boolean;
		readonly requestSelectedFn: () => void;
		readonly results: ReadonlyArray<Option>;
		readonly selectItemFn: (props: SelectItemProps) => void;
		readonly selectedIndex: number;
		readonly setSelectedIndexFn: (index: number) => void;
		readonly updateQueryFn: (query: string) => void;
	}
}

/** Owns query, selection, open autofocus, Escape close, and focus return for one item Spotlight. */
export const useItemSpotlightController = ({
	onCloseFn,
	onQueryChangeFn,
	onSelectItemFn,
	options,
	resultLimit,
}: useItemSpotlightController.Props): useItemSpotlightController.Output => {
	const inputRef = useRef<HTMLInputElement>(null);
	const resultsRef = useRef<HTMLDivElement>(null);
	const keyboardScrollPendingRef = useRef(false);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const [query, setQueryFn] = useState("");
	const [selectedIndex, setSelectedIndexFn] = useState(0);
	const candidates = useMemo(
		() =>
			options.map(({ itemUid, terms, identityTerms, descriptionTerms, keywordTerms }) => ({
				identity: itemUid,
				terms,
				identityTerms,
				descriptionTerms,
				keywordTerms,
			})),
		[
			options,
		],
	);
	const searchQuery = useDebouncedSearchQuery(query);
	const searchPending = query !== searchQuery;
	const matchingIds = useFuseSearch(candidates, searchQuery);
	const optionsById = useMemo(
		() =>
			new Map(
				options.map((option) => [
					option.itemUid,
					option,
				]),
			),
		[
			options,
		],
	);
	const results = useMemo(() => {
		const matchingOptions = matchingIds.flatMap((itemUid) => {
			const option = optionsById.get(itemUid);
			return option === undefined
				? []
				: [
						option,
					];
		});
		return resultLimit === undefined ? matchingOptions : matchingOptions.slice(0, resultLimit);
	}, [
		matchingIds,
		optionsById,
		resultLimit,
	]);
	const updateQueryFn = (value: string) => {
		keyboardScrollPendingRef.current = true;
		setQueryFn(value);
		setSelectedIndexFn(0);
		onQueryChangeFn?.(value);
	};
	const navigateSelectionFn = (index: number) => {
		keyboardScrollPendingRef.current = true;
		setSelectedIndexFn(index);
	};
	useLayoutEffect(() => {
		const menu = resultsRef.current;
		if (menu === null || searchPending || !keyboardScrollPendingRef.current) return;
		const selected = menu.querySelector<HTMLElement>('[data-ui-selected="true"]');
		if (selected === null) return;
		keyboardScrollPendingRef.current = false;
		// Scroll only the result list; scrollIntoView can also move the underlying page.
		const top = menu.getBoundingClientRect().top + menu.clientTop;
		const bottom = top + menu.clientHeight;
		const bounds = selected.getBoundingClientRect();
		if (bounds.top < top) menu.scrollTop -= top - bounds.top;
		else if (bounds.bottom > bottom) menu.scrollTop += bounds.bottom - bottom;
	}, [
		results,
		searchPending,
		selectedIndex,
	]);
	const selectItemFn = useCallback(
		({ index, itemUid }: useItemSpotlightController.SelectItemProps) => {
			if (searchPending) return;
			const option = results[index];
			if (option?.itemUid !== itemUid || option.disabled === true) return;
			setSelectedIndexFn(index);
			onSelectItemFn(itemUid);
		},
		[
			onSelectItemFn,
			results,
			searchPending,
		],
	);
	const requestSelectedFn = () => {
		const selected = results[selectedIndex];
		if (selected === undefined) return;
		selectItemFn({
			index: selectedIndex,
			itemUid: selected.itemUid,
		});
	};
	const onKeyDownFn = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		onCloseFn();
	};

	useEffect(() => {
		setSelectedIndexFn(0);
	}, [
		searchQuery,
	]);
	useEffect(() => {
		setSelectedIndexFn((current) => Math.min(current, Math.max(0, results.length - 1)));
	}, [
		results.length,
	]);
	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		inputRef.current?.focus();
		return () => {
			const previousFocus = previousFocusRef.current;
			if (previousFocus?.isConnected === true) previousFocus.focus();
		};
	}, []);

	return {
		inputRef,
		resultsRef,
		navigateSelectionFn,
		onKeyDownFn,
		query,
		searchPending,
		requestSelectedFn,
		results,
		selectItemFn,
		selectedIndex,
		setSelectedIndexFn,
		updateQueryFn,
	};
};
