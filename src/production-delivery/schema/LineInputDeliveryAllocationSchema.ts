import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/** One requested quantity within a concrete line material-input slot. */
export const LineInputDeliveryAllocationSchema = z
	.object({
		inputIndex: NonNegativeIntegerSchema.describe(
			"The zero-based material-input position targeted by this delivery.",
		),
		quantity: PositiveIntegerSchema.describe(
			"The maximum quantity this delivery may place into the target input.",
		),
	})
	.strict()
	.meta({
		id: "LineInputDeliveryAllocationSchema",
		description: "One quantity claim against a concrete line material-input slot.",
	});

export type LineInputDeliveryAllocationSchema = typeof LineInputDeliveryAllocationSchema;

export namespace LineInputDeliveryAllocationSchema {
	export type Type = z.infer<LineInputDeliveryAllocationSchema>;
}
