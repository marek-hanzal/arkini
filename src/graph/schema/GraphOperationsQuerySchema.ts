import { z } from "zod";
import { GraphDiscoveryBoundsSchema } from "~/graph/schema/GraphDiscoveryBoundsSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
const NumericRangeSchema = z
	.object({
		gte: z.number().nonnegative().optional(),
		lte: z.number().nonnegative().optional(),
		gt: z.number().nonnegative().optional(),
		lt: z.number().nonnegative().optional(),
	})
	.strict()
	.superRefine((range, context) => {
		const lower = Math.max(range.gte ?? -Infinity, range.gt ?? -Infinity);
		const upper = Math.min(range.lte ?? Infinity, range.lt ?? Infinity);
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

export const GraphOperationsQuerySchema = GraphDiscoveryBoundsSchema.extend({
	cursor: z.string().min(1).max(128).optional(),
	aggregate: z
		.discriminatedUnion("mode", [
			z
				.object({
					mode: z.literal("count"),
				})
				.strict(),
			z
				.object({
					mode: z.literal("group"),
					by: z.enum([
						"kind",
						"owner",
						"action",
						"effect",
						"ownership",
						"lineTitle",
					]),
				})
				.strict(),
		])
		.optional()
		.describe(
			"Count the whole filtered operation scope, or group it by one property. limit bounds returned groups, never scanned operations. Missing properties form a not-applicable group.",
		),
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
			runtimeSeconds: NumericRangeSchema.optional(),
			clockWeight: NumericRangeSchema.optional(),
			durationSeconds: NumericRangeSchema.optional(),
			intervalSeconds: NumericRangeSchema.optional(),
		})
		.strict()
		.optional()
		.describe(
			"AND-combined summary filters. A property absent from an operation kind never matches, including false. gte/lte inclusive; gt/lt exclusive.",
		),
})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:graph-operations-input",
		title: "Graph operations",
		description:
			"Search and filter authored operations without a root node; compact, snapshot-bound continuation.",
	});
export type GraphOperationsQuerySchema = typeof GraphOperationsQuerySchema;
export namespace GraphOperationsQuerySchema {
	export type Type = z.infer<GraphOperationsQuerySchema>;
}
