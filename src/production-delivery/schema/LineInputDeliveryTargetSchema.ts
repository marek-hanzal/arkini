import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

/** One exact material-input slot claimed by a travelling item. */
export const LineInputDeliveryTargetSchema = z
	.object({
		kind: z.literal("line-input"),
		ownerItemId: IdSchema.describe("The live runtime item that owns the target line."),
		lineUid: IdSchema.describe("The stable target line UID."),
		inputIndex: NonNegativeIntegerSchema.describe(
			"The exact material-input slot claimed by this item.",
		),
	})
	.strict()
	.meta({
		id: "LineInputDeliveryTargetSchema",
		description: "One exact live line and material-input slot.",
	});

export type LineInputDeliveryTargetSchema = typeof LineInputDeliveryTargetSchema;

export namespace LineInputDeliveryTargetSchema {
	export type Type = z.infer<LineInputDeliveryTargetSchema>;
}
