import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";

const NumericRangeSchema = z
	.object({
		min: z.number().nonnegative().optional(),
		max: z.number().nonnegative().optional(),
		gt: z.number().nonnegative().optional(),
		lt: z.number().nonnegative().optional(),
	})
	.strict()
	.superRefine((range, context) => {
		const lower = Math.max(range.min ?? -Infinity, range.gt ?? -Infinity);
		const upper = Math.min(range.max ?? Infinity, range.lt ?? Infinity);
		if (
			Object.values(range).every((value) => value === undefined) ||
			lower > upper ||
			(lower === upper && (range.gt === lower || range.lt === upper))
		)
			context.addIssue({
				code: "custom",
				message: "Provide bounds defining a nonempty numeric range.",
			});
	});

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
		search: z
			.object({
				text: z.string().trim().min(1).max(500),
				scope: z
					.enum([
						"title",
						"owner",
						"participant",
						"all",
					])
					.default("all"),
			})
			.strict()
			.optional()
			.describe(
				"Canonical Editor fuzzy search over operation titles, owner titles, participant titles, or all three; results use relevance order.",
			),
		filter: z
			.object({
				hasOutcomes: z.boolean().optional(),
				action: SourceActionSchema.optional(),
				effect: TargetEffectSchema.optional(),
				ownership: z
					.enum([
						"source",
						"receiver",
					])
					.optional(),
				clock: z.boolean().optional(),
				default: z.boolean().optional(),
				show: z.boolean().optional(),
				enable: z.boolean().optional(),
				runtimeMs: NumericRangeSchema.optional(),
				clockWeight: NumericRangeSchema.optional(),
				durationMs: NumericRangeSchema.optional(),
				intervalMs: NumericRangeSchema.optional(),
			})
			.strict()
			.optional()
			.describe(
				"AND-combined summary filters. A property absent from an operation kind never matches, including false. min/max inclusive; gt/lt exclusive.",
			),
		maxDepth: z.number().int().min(1).max(12).default(1),
		limit: z.number().int().min(1).max(200).default(50),
		maxExpansions: z.number().int().min(1).max(100000).default(10000),
		timeoutMs: z.number().int().min(1).max(5000).default(1000),
		revision: z.number().int().nonnegative().optional(),
		snapshotId: IdSchema.optional(),
		cursor: z.string().min(1).max(128).optional(),
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
				"search",
				"filter",
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
