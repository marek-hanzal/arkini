import { useEffect, useMemo, useState } from "react";

import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";
import { useItemLineSearchCandidates } from "~/ui/item-detail/useItemLineSearchCandidates";
import { useFuseSearch } from "~/ui/search/useFuseSearch";

export type ItemLineAvailabilityFilter = "available" | "all";

const isAvailableLine = (line: ItemDetailLines.Line) =>
	line.availability.kind === "available" || line.activeJob !== undefined;

/** Owns local filtering and resolves semantic search identities in authored line order. */
export const useItemLineSearch = (
	lines: Extract<
		ItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>,
	initialQuery = "",
	ignoreAvailability = false,
) => {
	const [query, setQuery] = useState(initialQuery);
	const availableLineCount = useMemo(
		() => lines.line.filter(isAvailableLine).length,
		[
			lines.line,
		],
	);
	const [availabilityFilter, setAvailabilityFilter] = useState<ItemLineAvailabilityFilter>(() =>
		ignoreAvailability || initialQuery.trim() !== "" || availableLineCount === 0
			? "all"
			: "available",
	);
	useEffect(() => {
		if (availabilityFilter !== "available" || availableLineCount !== 0) return;
		setAvailabilityFilter("all");
	}, [
		availabilityFilter,
		availableLineCount,
	]);
	const selectedLines = useMemo(
		() =>
			ignoreAvailability || availabilityFilter === "all"
				? lines.line
				: lines.line.filter(isAvailableLine),
		[
			availabilityFilter,
			ignoreAvailability,
			lines.line,
		],
	);
	const selectedProjection = useMemo(
		() => ({
			...lines,
			line: selectedLines,
		}),
		[
			lines,
			selectedLines,
		],
	);
	const searchCandidates = useItemLineSearchCandidates(selectedProjection);
	const matchingLineIds = useFuseSearch(searchCandidates, query);
	const matchingLineIdSet = useMemo(
		() => new Set(matchingLineIds),
		[
			matchingLineIds,
		],
	);
	const filteredLines = useMemo(
		() => selectedLines.filter((line) => matchingLineIdSet.has(line.lineId)),
		[
			matchingLineIdSet,
			selectedLines,
		],
	);
	return {
		availabilityFilter,
		availableLineCount,
		setAvailabilityFilter,
		query,
		setQuery,
		filteredLines,
		normalizedQuery: query.trim(),
	};
};
