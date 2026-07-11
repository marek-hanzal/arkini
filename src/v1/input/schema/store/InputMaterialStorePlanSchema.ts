import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/**
 * Quantity accepted from one delivered runtime item by one material input slot.
 */
export const InputMaterialStorePlanSchema = z
	.object({
		/**
		 * Stable identity of the delivered runtime item supplying the material.
		 */
		sourceItemId: IdSchema.describe(
			"The stable identity of the runtime item supplying this material.",
		),
		/**
		 * Positive quantity accepted from the delivered runtime item.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity accepted from the delivered runtime item.",
		),
	})
	.strict()
	.meta({
		id: "InputMaterialStorePlanSchema",
		description: "The quantity accepted from one delivered item by a material input slot.",
	});

export type InputMaterialStorePlanSchema = typeof InputMaterialStorePlanSchema;

export namespace InputMaterialStorePlanSchema {
	export type Type = z.infer<InputMaterialStorePlanSchema>;
}
