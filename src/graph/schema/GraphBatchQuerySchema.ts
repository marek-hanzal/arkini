import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";

/** Queries are admitted separately so one malformed query does not discard its siblings. */
export const GraphBatchQuerySchema = z
	.object({
		revision: z.number().int().nonnegative().optional(),
		snapshotId: IdSchema.optional(),
		queries: z
			.array(
				z
					.object({
						id: IdSchema,
						query: z
							.unknown()
							.describe(
								"A compact graph query matching graph_schema_json.querySchema. Invalid queries report per-entry errors without discarding valid siblings.",
							),
					})
					.strict(),
			)
			.min(1)
			.max(8),
	})
	.strict()
	.superRefine((input, context) => {
		const ids = new Set<string>();
		for (const [index, query] of input.queries.entries()) {
			if (ids.has(query.id))
				context.addIssue({
					code: "custom",
					path: [
						"queries",
						index,
						"id",
					],
					message: "Batch query IDs must be unique.",
				});
			ids.add(query.id);
		}
	})
	.meta({
		$id: "urn:serakki:schema:mcp:graph-query-batch-input",
		title: "Graph discovery batch",
		description:
			"Up to eight independently admitted discovery queries over one captured immutable snapshot.",
	});
export type GraphBatchQuerySchema = typeof GraphBatchQuerySchema;
export namespace GraphBatchQuerySchema {
	export type Type = z.infer<GraphBatchQuerySchema>;
}
