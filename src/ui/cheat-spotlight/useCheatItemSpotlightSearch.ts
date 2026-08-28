import { useCallback, useEffect, useMemo, useState } from "react";

import { useCheatItemCatalog } from "~/ui/cheat-spotlight/useCheatItemCatalog";
import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { useFuseSearch } from "~/ui/search/useFuseSearch";

const maxVisibleResults = 10;

export namespace useCheatItemSpotlightSearch {
	export type Item = ReturnType<typeof useCheatItemCatalog>[number];

	export interface Props {
		readonly game: PlayableGame;
	}

	export interface Output {
		readonly changeQuery: (query: string) => void;
		readonly query: string;
		readonly reset: () => void;
		readonly results: ReadonlyArray<Item>;
		readonly selectedIndex: number;
		readonly selectedItemId?: string;
		readonly setSelectedIndex: (index: number) => void;
	}
}

export const useCheatItemSpotlightSearch = ({
	game,
}: useCheatItemSpotlightSearch.Props): useCheatItemSpotlightSearch.Output => {
	const catalog = useCheatItemCatalog(game);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const searchCandidates = useMemo(
		() =>
			catalog.map((item) => ({
				identity: item.itemId,
				terms: [
					item.itemId,
					item.title,
				],
			})),
		[
			catalog,
		],
	);
	const matchingItemIds = useFuseSearch(searchCandidates, query);
	const catalogById = useMemo(
		() =>
			new Map(
				catalog.map((item) => [
					item.itemId,
					item,
				]),
			),
		[
			catalog,
		],
	);
	const results = useMemo(
		() =>
			matchingItemIds
				.flatMap((itemId) => {
					const item = catalogById.get(itemId);
					return item === undefined
						? []
						: [
								item,
							];
				})
				.slice(0, maxVisibleResults),
		[
			catalogById,
			matchingItemIds,
		],
	);
	const changeQuery = useCallback((value: string) => {
		setQuery(value);
		setSelectedIndex(0);
	}, []);
	const reset = useCallback(() => {
		setQuery("");
		setSelectedIndex(0);
	}, []);
	const selectedItemId = results[selectedIndex]?.itemId;

	useEffect(() => {
		setSelectedIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
	}, [
		results.length,
	]);

	return useMemo(
		() => ({
			changeQuery,
			query,
			reset,
			results,
			selectedIndex,
			selectedItemId,
			setSelectedIndex,
		}),
		[
			changeQuery,
			query,
			reset,
			results,
			selectedIndex,
			selectedItemId,
		],
	);
};
