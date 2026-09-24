import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";

export const GraphQuerySchema = z
	.object({
		kind: z.enum([
			"node",
			"connections",
			"traverse",
			"path",
		]),
		from: IdSchema.describe(
			"Node ID: item:<UID>, template:<UID>, space:<number>, space:previous, space:inventory:<template UID>, or start.",
		),
		to: IdSchema.optional().describe(
			"For path: exact destination. For connections: optional direct counterpart.",
		),
		direction: z
			.enum([
				"out",
				"in",
				"both",
			])
			.default("out"),
		kinds: z.array(GraphEdgeKindSchema).max(32).optional(),
		maxDepth: z.number().int().min(1).max(12).default(3),
		limit: z.number().int().min(1).max(1000).default(100),
		maxExpansions: z.number().int().min(1).max(100000).default(10000),
		timeoutMs: z.number().int().min(1).max(5000).default(1000),
		detail: z
			.enum([
				"summary",
				"full",
			])
			.default("full"),
		revision: z.number().int().nonnegative().optional(),
	})
	.strict()
	.superRefine((query, context) => {
		if (query.kind === "path" && query.to === undefined)
			context.addIssue({
				code: "custom",
				path: [
					"to",
				],
				message: "A path query requires to.",
			});
	})
	.meta({
		$id: "urn:serakki:schema:graph:editor-query-input",
		title: "Editor graph query",
		description: "Internal bounded queries for Editor relationship details and counts.",
	});
export type GraphQuerySchema = typeof GraphQuerySchema;
export namespace GraphQuerySchema {
	export type Type = z.infer<GraphQuerySchema>;
}
