import { z } from "zod";
import { GraphDiscoveryBoundsSchema } from "~/graph/schema/GraphDiscoveryBoundsSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";

export const GraphTraverseQuerySchema = GraphDiscoveryBoundsSchema.extend({
	from: IdSchema,
	direction: z
		.enum([
			"out",
			"in",
			"both",
		])
		.default("out"),
	kinds: z.array(GraphEdgeKindSchema).max(32).optional(),
	maxDepth: z.number().int().min(1).max(12).default(1),
})
	.strict()
	.superRefine((query, context) => {
		if (query.maxDepth > 1 && (query.kinds === undefined || query.kinds.length === 0))
			context.addIssue({
				code: "custom",
				path: [
					"kinds",
				],
				message: "Traversal deeper than one hop requires explicit nonempty edge kinds.",
			});
	})
	.meta({
		$id: "urn:serakki:schema:mcp:graph-traverse-input",
		title: "Graph traverse",
		description:
			"Advanced broad structural exploration. Depth above one requires explicit nonempty edge kinds.",
	});
export type GraphTraverseQuerySchema = typeof GraphTraverseQuerySchema;
export namespace GraphTraverseQuerySchema {
	export type Type = z.infer<GraphTraverseQuerySchema>;
}
