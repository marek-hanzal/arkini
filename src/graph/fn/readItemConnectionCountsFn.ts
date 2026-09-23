import { readItemConnectionQueryFn } from "~/graph/fn/readItemConnectionQueryFn";
import { ItemConnectionFilterSchema } from "~/graph/schema/ItemConnectionFilterSchema";
import type { GraphEdge } from "~/graph/type/GraphFacts";

/** Counts occurrences from an all-directions connection result using the query presets. */
export const readItemConnectionCountsFn = (
	itemUid: string,
	edges: readonly GraphEdge[],
): Readonly<Record<ItemConnectionFilterSchema.Type, number>> => {
	const counts = {} as Record<ItemConnectionFilterSchema.Type, number>;
	for (const filter of ItemConnectionFilterSchema.options) {
		const query = readItemConnectionQueryFn(itemUid, filter);
		counts[filter] = edges.filter(
			(edge) =>
				(query.kinds === undefined || query.kinds.includes(edge.kind)) &&
				((query.direction !== "in" && edge.from === query.from) ||
					(query.direction !== "out" && edge.to === query.from)),
		).length;
	}
	return counts;
};
