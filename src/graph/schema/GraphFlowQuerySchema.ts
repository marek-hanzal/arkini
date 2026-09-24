import { z } from "zod";
import { GraphDiscoveryBoundsSchema } from "~/graph/schema/GraphDiscoveryBoundsSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";

export const GraphFlowQuerySchema = GraphDiscoveryBoundsSchema.extend({
	limit: GraphDiscoveryBoundsSchema.shape.limit.removeDefault().default(5),
	from: IdSchema,
	to: IdSchema,
	operationKinds: z
		.array(
			z.enum([
				"line",
				"merge",
				"clock",
				"depletion",
			]),
		)
		.max(4)
		.optional(),
	maxDepth: z
		.number()
		.int()
		.min(1)
		.max(12)
		.default(5)
		.describe("Maximum authored operation steps per flow."),
})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:graph-flow-input",
		title: "Graph flow",
		description:
			"Directed simple paths through authored operations with factual rule and stochastic evidence; no gameplay evaluation.",
	});
export type GraphFlowQuerySchema = typeof GraphFlowQuerySchema;
export namespace GraphFlowQuerySchema {
	export type Type = z.infer<GraphFlowQuerySchema>;
}
