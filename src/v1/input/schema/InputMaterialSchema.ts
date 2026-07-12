import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";
import { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";
import { BaseInputSchema } from "./BaseInputSchema";
import { InputEnumSchema } from "./InputEnumSchema";
import { InputModeEnumSchema } from "./InputModeEnumSchema";

/**
 * A directly delivered material item required by a product line.
 *
 * The matching items either disappear through `consume` or are temporarily
 * held through `reserve` and then returned after the line finishes or is
 * cancelled. Quantity and capacity aggregate every item matched by the selector.
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
		 * Item or tag matching strategy for materials accepted by this input.
		 */
		selector: SelectorSchema.describe(
			"The item or tag matching strategy for materials accepted by this input.",
		),
		/**
		 * Whether this input is consumed or temporarily reserved by the line.
		 *
		 * A reserved input is emitted through the standard drop-placement policy when
		 * the work completes or is cancelled. Consumption is the standard behavior.
		 */
		mode: InputModeEnumSchema.default("consume").describe(
			"Whether this input is consumed or reserved; defaults to consume.",
		),
		/**
		 * Exact or bounded total amount accepted by this input.
		 *
		 * The amount aggregates every material item that matches this selector. A
		 * range quantity replaces the legacy `upTo` input mode.
		 */
		quantity: QuantitySchema.describe(
			"The exact or bounded total amount accepted across all matching materials.",
		),
		/**
		 * Extra total quantity this input may buffer above its required `quantity`.
		 *
		 * Zero accepts exactly the quantity required by the line and no additional
		 * items. A positive value allows that many extra items to wait in the input.
		 */
		capacity: NonNegativeIntegerSchema.default(0).describe(
			"The extra total quantity this input may buffer above its required quantity; defaults to zero, which allows no extra materials.",
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
