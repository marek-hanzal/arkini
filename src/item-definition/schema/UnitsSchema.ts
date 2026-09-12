import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";

/**
 * Finite unit supply of one concrete item instance, such as health, resource stock, or uses.
 *
 * An exhausted item follows the shared depletion lifecycle when its units reach zero. The optional
 * output is emitted exactly once from the depleted item's board origin.
 */
export const UnitsSchema = z
	.object({
		/**
		 * Number of units owned by every fresh instance of this canonical item.
		 */
		amount: PositiveIntegerSchema.describe(
			"The positive number of units owned by every fresh item instance.",
		),
		/**
		 * Optional output emitted exactly once when one instance is depleted.
		 */
		output: OutputSchema.optional().describe(
			"The optional output emitted exactly once from the depleted item's real grid origin.",
		),
	})
	.strict()
	.meta({
		id: "UnitsSchema",
		description: "A finite unit supply and optional output emitted on depletion.",
	});

export type UnitsSchema = typeof UnitsSchema;

export namespace UnitsSchema {
	export type Type = z.infer<UnitsSchema>;
}
