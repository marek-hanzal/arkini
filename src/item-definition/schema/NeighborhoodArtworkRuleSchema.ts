import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";

const neighborSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("ignore"),
		})
		.strict(),
	z
		.object({
			type: z.literal("empty"),
		})
		.strict(),
	z
		.object({
			type: z.literal("filled"),
		})
		.strict(),
	z
		.object({
			type: z.literal("item"),
			itemId: IdSchema,
		})
		.strict(),
]);

/** A same-layer Board neighborhood selects artwork without changing item identity. */
export const NeighborhoodArtworkRuleSchema = z
	.object({
		neighbors: z
			.object({
				nw: neighborSchema,
				n: neighborSchema,
				ne: neighborSchema,
				w: neighborSchema,
				e: neighborSchema,
				sw: neighborSchema,
				s: neighborSchema,
				se: neighborSchema,
			})
			.strict()
			.describe(
				"Eight same-layer neighbors; north is decreasing board Y. Outside the Board is empty. All conditions must match.",
			),
		sourceId: IdSchema.describe(
			"The single asset replacing the complete artwork when this rule is the first match.",
		),
	})
	.strict()
	.meta({
		id: "NeighborhoodArtworkRuleSchema",
		description: "One ordered visual-only Board neighborhood rule.",
	});

export type NeighborhoodArtworkRuleSchema = typeof NeighborhoodArtworkRuleSchema;

export namespace NeighborhoodArtworkRuleSchema {
	export type Type = z.infer<NeighborhoodArtworkRuleSchema>;
}
