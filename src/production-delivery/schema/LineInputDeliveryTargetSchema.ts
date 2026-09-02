import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { LineInputDeliveryAllocationSchema } from "./LineInputDeliveryAllocationSchema";

/** One exact line whose material slots may accept an outbound delivery. */
export const LineInputDeliveryTargetSchema = z
	.object({
		kind: z.literal("line-input"),
		ownerItemId: IdSchema.describe("The live runtime item that owns the target line."),
		lineId: IdSchema.describe("The stable target line ID."),
		input: z
			.array(LineInputDeliveryAllocationSchema)
			.min(1)
			.describe("The ordered material-input quantities claimed by this delivery."),
	})
	.strict()
	.meta({
		id: "LineInputDeliveryTargetSchema",
		description: "One exact live line and its ordered delivery allocations.",
	});

export type LineInputDeliveryTargetSchema = typeof LineInputDeliveryTargetSchema;

export namespace LineInputDeliveryTargetSchema {
	export type Type = z.infer<LineInputDeliveryTargetSchema>;
}
