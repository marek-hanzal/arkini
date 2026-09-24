import { z } from "zod";
import { GraphAuditQuerySchema } from "./GraphAuditQuerySchema";
import { GraphSearchQuerySchema } from "./GraphSearchQuerySchema";
import { GraphConnectionsQuerySchema } from "./GraphConnectionsQuerySchema";
import { GraphOperationsQuerySchema } from "./GraphOperationsQuerySchema";
import { GraphPathQuerySchema } from "./GraphPathQuerySchema";
import { GraphFlowQuerySchema } from "./GraphFlowQuerySchema";
import { GraphTraverseQuerySchema } from "./GraphTraverseQuerySchema";

/** Batch admission and shared backend dispatch; focused MCP tools expose only their own fields. */
export const GraphDiscoveryQuerySchema = z
	.discriminatedUnion("kind", [
		GraphAuditQuerySchema.safeExtend({
			kind: z.literal("audit"),
		}),
		GraphSearchQuerySchema.safeExtend({
			kind: z.literal("search"),
		}),
		GraphConnectionsQuerySchema.safeExtend({
			kind: z.literal("connections"),
		}),
		GraphOperationsQuerySchema.safeExtend({
			kind: z.literal("operations"),
		}),
		GraphPathQuerySchema.safeExtend({
			kind: z.literal("path"),
		}),
		GraphFlowQuerySchema.safeExtend({
			kind: z.literal("flow"),
		}),
		GraphTraverseQuerySchema.safeExtend({
			kind: z.literal("traverse"),
		}),
	])
	.meta({
		$id: "urn:serakki:schema:graph:discovery-query-input",
		title: "Focused graph discovery query",
		description: "Internal and batch dispatch union of focused graph discovery inputs.",
	});
export type GraphDiscoveryQuerySchema = typeof GraphDiscoveryQuerySchema;
export namespace GraphDiscoveryQuerySchema {
	export type Type = z.infer<GraphDiscoveryQuerySchema>;
}
