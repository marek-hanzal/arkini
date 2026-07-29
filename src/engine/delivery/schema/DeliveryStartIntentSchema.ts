import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/**
 * One persisted request to start a line after its physically delivered inputs become ready.
 *
 * This aggregate outlives every individual cargo identity, including exact-size deliveries that
 * fully become input before the remaining line requirements are satisfied.
 */
export const DeliveryStartIntentSchema = z.preprocess(
	(input) => {
		if (
			typeof input !== "object" ||
			input === null ||
			!("source" in input) ||
			input.source !== "player"
		) {
			return input;
		}
		const { source: _source, ...intent } = input;
		return intent;
	},
	z
		.object({
			ownerItemId: IdSchema,
			lineId: IdSchema,
		})
		.strict()
		.meta({
			id: "DeliveryStartIntentSchema",
			description: "A durable post-delivery line-start request.",
		}),
);

export type DeliveryStartIntentSchema = typeof DeliveryStartIntentSchema;

export namespace DeliveryStartIntentSchema {
	export type Type = z.infer<DeliveryStartIntentSchema>;
}
