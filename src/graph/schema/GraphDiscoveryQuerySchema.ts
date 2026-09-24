import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";

/** Compact discovery is independent from the Editor's full relationship projection. */
export const GraphDiscoveryQuerySchema = z
	.object({
		kind: z.enum([
			"node",
			"connections",
			"traverse",
			"path",
			"operations",
		]),
		from: IdSchema.optional(),
		to: IdSchema.optional(),
		direction: z
			.enum([
				"out",
				"in",
				"both",
			])
			.default("both"),
		kinds: z.array(GraphEdgeKindSchema).max(32).optional(),
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
		owner: IdSchema.optional(),
		participant: IdSchema.optional(),
		role: z
			.enum([
				"owner",
				"target",
				"input",
				"output",
				"reference",
			])
			.optional(),
		maxDepth: z.number().int().min(1).max(12).default(1),
		limit: z.number().int().min(1).max(200).default(50),
		maxExpansions: z.number().int().min(1).max(100000).default(10000),
		timeoutMs: z.number().int().min(1).max(5000).default(1000),
		revision: z.number().int().nonnegative().optional(),
		snapshotId: IdSchema.optional(),
		cursor: z.string().min(1).max(8192).optional(),
	})
	.strict()
	.superRefine((query, context) => {
		const issueFn = (path: string, message: string) =>
			context.addIssue({
				code: "custom",
				path: [
					path,
				],
				message,
			});
		if (query.kind !== "operations" && query.from === undefined)
			issueFn("from", "A node-based query requires from.");
		if (query.kind === "path" && query.to === undefined)
			issueFn("to", "A path query requires to.");
		if (query.kind !== "operations") {
			for (const key of [
				"operationKinds",
				"owner",
				"participant",
				"role",
				"cursor",
			] as const)
				if (query[key] !== undefined)
					issueFn(key, `${key} is only supported by operation discovery.`);
		} else {
			for (const key of [
				"from",
				"to",
				"kinds",
			] as const)
				if (query[key] !== undefined)
					issueFn(key, `${key} is not supported by operation discovery.`);
		}
	})
	.meta({
		$id: "urn:serakki:schema:mcp:graph-query-input",
		title: "Graph discovery",
		description:
			"Bounded compact authored relationships or indexed operations. Operation continuations carry their snapshot and filter binding.",
	});
export type GraphDiscoveryQuerySchema = typeof GraphDiscoveryQuerySchema;
export namespace GraphDiscoveryQuerySchema {
	export type Type = z.infer<GraphDiscoveryQuerySchema>;
}
