import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";

/** Authored-consequence policy for Editor Chain. */
export const readItemChainQueryFn = (
	itemUid: string,
	maxDepth = 5,
	detail: "summary" | "full" = "full",
): GraphQuerySchema.Type => ({
	kind: "traverse",
	from: `item:${itemUid}`,
	direction: "out",
	kinds: [
		"line-item-outcome",
		"merge-replacement",
		"merge-target-replacement",
		"merge-item-outcome",
		"depletion-item-outcome",
		"merge-space",
		"space-outcome",
		"template-outcome",
		"start-template",
		"template-item",
	],
	maxDepth,
	detail,
	limit: 100,
	maxExpansions: 10000,
	timeoutMs: 1000,
});
