import { z } from "zod";
import { GraphDiscoveryBoundsSchema } from "~/graph/schema/GraphDiscoveryBoundsSchema";

export const GraphAuditQuerySchema = GraphDiscoveryBoundsSchema.extend({
	audit: z.enum([
		"dangling",
		"no-producer",
		"no-usage",
		"no-behavior",
		"source-only",
		"reference-only",
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
			"Snapshot-native authored item facts with exact operation references and pinned continuation. No gameplay rule evaluation or design judgement.",
	});
export type GraphAuditQuerySchema = typeof GraphAuditQuerySchema;
export namespace GraphAuditQuerySchema {
	export type Type = z.infer<GraphAuditQuerySchema>;
}
