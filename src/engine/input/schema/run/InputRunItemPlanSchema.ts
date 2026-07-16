import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/**
 * Quantity allocated from one concrete buffered runtime item to one line run.
 */
export const InputRunItemPlanSchema = z
	.object({
		/**
		 * Stable identity of the buffered runtime item supplying this quantity.
		 */
		itemId: IdSchema.describe(
			"The stable identity of the buffered runtime item supplying this quantity.",
		),
		/**
		 * Positive quantity allocated from this runtime item.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity allocated from this buffered runtime item.",
		),
	})
	.strict()
	.meta({
		id: "InputRunItemPlanSchema",
		description: "Quantity allocated from one buffered runtime item to one line run.",
	});

export type InputRunItemPlanSchema = typeof InputRunItemPlanSchema;

export namespace InputRunItemPlanSchema {
	export type Type = z.infer<InputRunItemPlanSchema>;
}
