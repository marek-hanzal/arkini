import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import type { ItemConnectionFilterSchema } from "~/graph/schema/ItemConnectionFilterSchema";

/** UI presets select typed roles; rule mentions never become consumed inputs. */
export const readItemConnectionQueryFn = (
	itemUid: string,
	filter: ItemConnectionFilterSchema.Type,
	to?: string,
): GraphQuerySchema.Type => ({
	kind: "connections",
	from: `item:${itemUid}`,
	to,
	direction:
		filter === "all"
			? "both"
			: filter === "accepts-merge" ||
					filter === "inputs" ||
					filter === "produced-by" ||
					filter === "referenced-by"
				? "in"
				: "out",
	kinds:
		filter === "all"
			? undefined
			: filter === "merges-into" || filter === "accepts-merge"
				? [
						"merge-target",
					]
				: filter === "references" || filter === "referenced-by"
					? [
							"rule-reference",
						]
					: filter === "inputs" || filter === "required-by"
						? [
								"line-material",
								"line-unit-selector",
								"line-unit-cost",
							]
						: [
								"line-item-outcome",
								"merge-replacement",
								"merge-item-outcome",
								"clock-item-outcome",
								"depletion-item-outcome",
								"space-outcome",
								"template-outcome",
							],
	maxDepth: 1,
	detail: "full",
	limit: 100,
	maxExpansions: 10000,
	timeoutMs: 1000,
});
