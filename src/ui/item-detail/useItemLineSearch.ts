import { useMemo, useState } from "react";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { useItemLineSearchCandidates } from "~/ui/item-detail/useItemLineSearchCandidates";
import { useFuseSearch } from "~/ui/search/useFuseSearch";

export type ItemLineAvailabilityFilter = "available" | "all";

/** Owns local filtering and resolves semantic search identities in authored line order. */
export const useItemLineSearch = (
	lines: Extract<
		ItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>,
) => {
	const [query, setQuery] = useState("");
	const [availabilityFilter, setAvailabilityFilter] =
		useState<ItemLineAvailabilityFilter>("available");
	const availableLineCount = useMemo(
		() => lines.line.filter((line) => line.availability.kind === "available").length,
		[
			lines.line,
		],
	);
	const selectedLines = useMemo(
		() =>
			availabilityFilter === "all"
				? lines.line
				: lines.line.filter((line) => line.availability.kind === "available"),
		[
			availabilityFilter,
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
		setAvailabilityFilter,
		availableLineCount,
		query,
		setQuery,
		filteredLines,
		normalizedQuery: query.trim(),
	};
};
