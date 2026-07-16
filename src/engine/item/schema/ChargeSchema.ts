import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";

/**
 * Finite authored lifetime of one concrete item instance.
 *
 * A charged item dies after its remaining charges reach zero. The optional
 * output is emitted exactly once from the depleted item's board origin.
 */
export const ChargeSchema = z
	.object({
		/**
		 * Number of charges owned by every fresh instance of this canonical item.
		 */
		amount: PositiveIntegerSchema.describe(
			"The positive number of charges owned by every fresh item instance.",
		),
		/**
		 * Optional output emitted exactly once when one instance is depleted.
		 */
		output: OutputSchema.optional().describe(
			"The optional output emitted exactly once when one item instance is depleted.",
		),
	})
	.strict()
	.meta({
		id: "ChargeSchema",
		description: "A finite item lifetime and optional output emitted on depletion.",
	});

export type ChargeSchema = typeof ChargeSchema;

export namespace ChargeSchema {
	export type Type = z.infer<ChargeSchema>;
}
