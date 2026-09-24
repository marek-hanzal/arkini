import { z } from "zod";
import { GraphDiscoveryBoundsSchema } from "~/graph/schema/GraphDiscoveryBoundsSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";

export const GraphConnectionsQuerySchema = GraphDiscoveryBoundsSchema.extend({
	cursor: z.string().min(1).max(128).optional(),
	from: IdSchema.describe("Exact root graph node ID."),
	to: IdSchema.optional().describe("Optional exact direct counterpart node."),
	direction: z
		.enum([
			"out",
			"in",
			"both",
		])
		.default("both"),
	kinds: z.array(GraphEdgeKindSchema).max(32).optional(),
})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:graph-connections-input",
		title: "Graph connections",
		description:
			"Direct authored relationships of one node, with optional counterpart and compact continuation.",
	});
export type GraphConnectionsQuerySchema = typeof GraphConnectionsQuerySchema;
export namespace GraphConnectionsQuerySchema {
	export type Type = z.infer<GraphConnectionsQuerySchema>;
}
