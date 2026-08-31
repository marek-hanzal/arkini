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
		readonly itemId: string;
		readonly label: string;
		readonly secondary: string;
		readonly terms: ReadonlyArray<string>;
	}

	export interface Props {
		readonly onClose: () => void;
		readonly onQueryChange?: (query: string) => void;
		readonly onSelectItem: (itemId: string) => void;
		readonly options: ReadonlyArray<Option>;
		readonly resultLimit?: number;
	}

	export interface SelectItemProps {
		readonly index: number;
		readonly itemId: string;
	}

	export interface Output {
		readonly inputRef: RefObject<HTMLInputElement | null>;
		readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
		readonly query: string;
		readonly requestSelected: () => void;
		readonly results: ReadonlyArray<Option>;
		readonly selectItem: (props: SelectItemProps) => void;
		readonly selectedIndex: number;
		readonly setSelectedIndex: (index: number) => void;
		readonly updateQuery: (query: string) => void;
	}
}

/** Owns query, selection, open autofocus, Escape close, and focus return for one item Spotlight. */
export const useItemSpotlightController = ({
	onClose,
	onQueryChange,
	onSelectItem,
	options,
	resultLimit,
}: useItemSpotlightController.Props): useItemSpotlightController.Output => {
	const inputRef = useRef<HTMLInputElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
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
	const updateQuery = (value: string) => {
		setQuery(value);
		setSelectedIndex(0);
		onQueryChange?.(value);
	};
	const selectItem = ({ index, itemId }: useItemSpotlightController.SelectItemProps) => {
		setSelectedIndex(index);
		onSelectItem(itemId);
	};
	const requestSelected = () => {
		const selected = results[selectedIndex];
		if (selected === undefined) return;
		selectItem({
			index: selectedIndex,
			itemId: selected.itemId,
		});
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		onClose();
	};

	useEffect(() => {
		setSelectedIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
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
		onKeyDown,
		query,
		requestSelected,
		results,
		selectItem,
		selectedIndex,
		setSelectedIndex,
		updateQuery,
	};
};
