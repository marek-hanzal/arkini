import { useMemo, useState } from "react";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { useItemLineSearchCandidates } from "~/ui/item-detail/useItemLineSearchCandidates";
import { useFuseSearch } from "~/ui/search/useFuseSearch";

/** Owns query state and resolves semantic search identities against the latest line projection. */
export const useItemLineSearch = (
	lines: Extract<
		ItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>,
) => {
	const [query, setQuery] = useState("");
	const searchCandidates = useItemLineSearchCandidates(lines);
	const matchingLineIds = useFuseSearch(searchCandidates, query);
	const lineById = useMemo(
		() =>
			new Map(
				lines.line.map((line) => [
					line.lineId,
					line,
				]),
			),
		[
			lines.line,
		],
	);
	const filteredLines = useMemo(
		() =>
			matchingLineIds.flatMap((lineId) => {
				const line = lineById.get(lineId);
				return line === undefined
					? []
					: [
							line,
						];
			}),
		[
			lineById,
			matchingLineIds,
		],
	);
	return {
		query,
		setQuery,
		filteredLines,
		normalizedQuery: query.trim(),
	};
};
