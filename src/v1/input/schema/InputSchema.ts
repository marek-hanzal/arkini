import { z } from "zod";

import { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { InputModeEnumSchema } from "./InputModeEnumSchema";

/**
 * A canonical game item and the amount accepted by a gameplay input.
 *
 * A `quantity` with type `value` requires that exact amount. A quantity with
 * type `range`, typically from one to a maximum, replaces the legacy `upTo`
 * input mode by accepting an amount inside that inclusive range.
 */
export const InputSchema = z
	.object({
		/**
		 * ID of the canonical game item accepted by this input.
		 */
		itemId: IdSchema.describe("The ID of the canonical game item accepted by this input."),
		/**
		 * Whether this input is consumed or temporarily reserved by the line.
		 *
		 * A reserved input returns to its prior game-state location when the work
		 * completes or is cancelled. Consumption is the standard input behavior.
		 */
		mode: InputModeEnumSchema.default("consume").describe(
			"Whether this input is consumed or reserved; defaults to consume.",
		),
		/**
		 * Exact or bounded amount accepted by this input.
		 *
		 * A range quantity replaces the legacy `upTo` input mode.
		 */
		quantity: QuantitySchema.describe(
			"The exact or bounded amount accepted by this input, replacing legacy upTo mode.",
		),
		/**
		 * Extra quantity this input may buffer above its required `quantity`.
		 *
		 * Zero accepts exactly the quantity required by the line and no additional
		 * items. A positive value allows that many extra items to wait in the input.
		 */
		capacity: NonNegativeIntegerSchema.default(0).describe(
			"The extra quantity this input may buffer above its required quantity; defaults to zero, which allows no extra items.",
		),
	})
	.strict()
	.meta({
		id: "InputSchema",
		description: "A canonical game item, required amount, and extra input-buffer capacity.",
	});

export type InputSchema = typeof InputSchema;

export namespace InputSchema {
	export type Type = z.infer<InputSchema>;
}
