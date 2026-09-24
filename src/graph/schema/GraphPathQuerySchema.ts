import { z } from "zod";
import { GraphDiscoveryBoundsSchema } from "~/graph/schema/GraphDiscoveryBoundsSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";

export const GraphPathQuerySchema = GraphDiscoveryBoundsSchema.extend({
	from: IdSchema,
	to: IdSchema,
	direction: z
		.enum([
			"out",
			"in",
			"both",
		])
		.default("both"),
	kinds: z.array(GraphEdgeKindSchema).max(32).optional(),
	maxDepth: z
		.number()
		.int()
		.min(1)
		.max(12)
		.default(5)
		.describe("Maximum relationship hops per path."),
})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:graph-path-input",
		title: "Graph path",
		description:
			"Structural paths in the authored graph; not gameplay recipes or proof of runtime feasibility.",
	});
export type GraphPathQuerySchema = typeof GraphPathQuerySchema;
export namespace GraphPathQuerySchema {
	export type Type = z.infer<GraphPathQuerySchema>;
}
