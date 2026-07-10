import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";
import { BaseInputSchema } from "./BaseInputSchema";
import { InputEnumSchema } from "./InputEnumSchema";
import { InputModeEnumSchema } from "./InputModeEnumSchema";

/**
 * A directly delivered material item required by a product line.
 *
 * The item either disappears through `consume` or is temporarily held through
 * `reserve` and then returned after the line finishes or is cancelled.
 */
export const InputMaterialSchema = z
	.object({
		...BaseInputSchema.shape,
		/**
		 * Identifies this input as a directly delivered material item.
		 */
		type: InputEnumSchema.extract([
			"materials",
		]).describe("Identifies this input as a directly delivered material item."),
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
		id: "InputMaterialSchema",
		description: "A directly delivered material item required by a product line.",
	});

export type InputMaterialSchema = typeof InputMaterialSchema;

export namespace InputMaterialSchema {
	export type Type = z.infer<InputMaterialSchema>;
}
