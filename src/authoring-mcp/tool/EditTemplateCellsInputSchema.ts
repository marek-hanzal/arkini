import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { PositionSchema } from "~/item-location/schema/PositionSchema";

export const EditTemplateCellsInputSchema = z
	.object({
		revision: NonNegativeIntegerSchema,
		templateUid: IdSchema,
		changes: z
			.array(
				z.discriminatedUnion("type", [
					z
						.object({
							type: z.literal("place"),
							...PositionSchema.shape,
							itemUid: IdSchema,
						})
						.strict(),
					z
						.object({
							type: z.literal("replace"),
							...PositionSchema.shape,
							itemUid: IdSchema,
						})
						.strict(),
					z
						.object({
							type: z.literal("move"),
							from: PositionSchema,
							to: PositionSchema,
						})
						.strict(),
					z
						.object({
							type: z.literal("remove"),
							...PositionSchema.shape,
						})
						.strict(),
				]),
			)
			.min(1)
			.max(100)
			.describe(
				"Ordered changes against one candidate. Place requires an empty cell; replace/remove require an occupied cell; move requires an occupied source and empty destination. Any invalid change rejects the whole batch.",
			),
	})
	.strict()
	.meta({
		id: "urn:serakki:schema:mcp:edit-template-cells-input",
		$id: "urn:serakki:schema:mcp:edit-template-cells-input",
		title: "Edit template cells input",
		description:
			"Change 1–100 cells without resending the board. Coordinates are zero-based; every position must be in bounds. One guarded commit preserves other templates and start-space assignments.",
	});

export type EditTemplateCellsInputSchema = typeof EditTemplateCellsInputSchema;
export namespace EditTemplateCellsInputSchema {
	export type Type = z.infer<EditTemplateCellsInputSchema>;
}
