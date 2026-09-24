import { z } from "zod";
import { GraphDiscoveryBoundsSchema } from "~/graph/schema/GraphDiscoveryBoundsSchema";

export const GraphAuditQuerySchema = GraphDiscoveryBoundsSchema.extend({
	audit: z.enum([
		"dangling",
		"no-producer",
		"no-consumer",
		"dead-end",
		"source-only",
		"reference-only",
		"no-owned-operation",
	]),

	mode: z
		.enum([
			"list",
			"count",
		])
		.default("list"),
	cursor: z.string().min(1).max(128).optional(),
})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:graph-audit-input",
		title: "Graph audit",
		description:
			"Snapshot-native item design audits with reasons and pinned continuation. dead-end is the canonical sink audit.",
	});
export type GraphAuditQuerySchema = typeof GraphAuditQuerySchema;
export namespace GraphAuditQuerySchema {
	export type Type = z.infer<GraphAuditQuerySchema>;
}
