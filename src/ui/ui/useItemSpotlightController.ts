import {
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { useFuseSearch } from "~/ui/ui/useFuseSearch";

export namespace useItemSpotlightController {
	export interface Option {
		readonly artwork: ReactNode;
		readonly disabled?: boolean;
		readonly disabledReason?: ReactNode;
		readonly itemId: string;
		readonly label: string;
		readonly secondary: string;
		readonly terms: ReadonlyArray<string>;
	}

	export interface Props {
		readonly onCloseFn: () => void;
		readonly onQueryChangeFn?: (query: string) => void;
		readonly onSelectItemFn: (itemId: string) => void;
		readonly options: ReadonlyArray<Option>;
		readonly resultLimit?: number;
	}

	export interface SelectItemProps {
		readonly index: number;
		readonly itemId: string;
	}

	export interface Output {
		readonly inputRef: RefObject<HTMLInputElement | null>;
		readonly onKeyDownFn: (event: KeyboardEvent<HTMLDivElement>) => void;
		readonly query: string;
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
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const [query, setQueryFn] = useState("");
	const [selectedIndex, setSelectedIndexFn] = useState(0);
	const candidates = useMemo(
		() =>
			options.map(({ itemId, terms }) => ({
				identity: itemId,
				terms,
			})),
		[
			options,
		],
	);
	const matchingIds = useFuseSearch(candidates, query);
	const optionsById = useMemo(
		() =>
			new Map(
				options.map((option) => [
					option.itemId,
					option,
				]),
			),
		[
			options,
		],
	);
	const results = useMemo(() => {
		const matchingOptions = matchingIds.flatMap((itemId) => {
			const option = optionsById.get(itemId);
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
		setQueryFn(value);
		setSelectedIndexFn(0);
		onQueryChangeFn?.(value);
	};
	const selectItemFn = ({ index, itemId }: useItemSpotlightController.SelectItemProps) => {
		const option = results[index];
		if (option?.itemId !== itemId || option.disabled === true) return;
		setSelectedIndexFn(index);
		onSelectItemFn(itemId);
	};
	const requestSelectedFn = () => {
		const selected = results[selectedIndex];
		if (selected === undefined) return;
		selectItemFn({
			index: selectedIndex,
			itemId: selected.itemId,
		});
	};
	const onKeyDownFn = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		onCloseFn();
	};

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
		onKeyDownFn,
		query,
		requestSelectedFn,
		results,
		selectItemFn,
		selectedIndex,
		setSelectedIndexFn,
		updateQueryFn,
	};
};
