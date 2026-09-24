import { z } from "zod";
import { GraphDiscoveryBoundsSchema } from "~/graph/schema/GraphDiscoveryBoundsSchema";

export const GraphSearchQuerySchema = GraphDiscoveryBoundsSchema.pick({
	limit: true,
	revision: true,
	snapshotId: true,
})
	.extend({
		query: z
			.string()
			.trim()
			.min(1)
			.max(500)
			.describe(
				"Human title, exact node ID or identity fragment; canonical Editor fuzzy search.",
			),
		nodeKinds: z
			.array(
				z.enum([
					"item",
					"template",
					"space",
					"start",
				]),
			)
			.max(4)
			.optional(),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:graph-search-input",
		title: "Graph search",
		description:
			"Find titled graph nodes by title or identity without authored configuration bodies.",
	});
export type GraphSearchQuerySchema = typeof GraphSearchQuerySchema;
export namespace GraphSearchQuerySchema {
	export type Type = z.infer<GraphSearchQuerySchema>;
}
