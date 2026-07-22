import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

import { BaseInputSchema } from "./BaseInputSchema";
import { InputEnumSchema } from "./InputEnumSchema";
import { InputModeEnumSchema } from "./InputModeEnumSchema";

/**
 * A directly delivered material item required by a product line.
 *
 * The matching items are committed to the active job. `consume` destroys passive
 * owned state at start and discards the committed root at completion; `reserve`
 * retains the same live instance and relocates it after completion. Quantity and
 * capacity aggregate every item matched by the selector.
 */
export const InputMaterialSchema = z
	.object({
		...BaseInputSchema.shape,
		/**
		 * Identifies this input as a directly delivered material item.
		 */
		type: InputEnumSchema.extract([
			InputEnumSchema.enum.Materials,
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
		 * A reserved input retains the same live instance in reserved scope and uses
		 * canonical existing-item placement when work completes. A consumed input
		 * discards passive owned state when the job starts and its committed root when
		 * the job completes. Started jobs are not cancellable.
		 */
		mode: InputModeEnumSchema.default(InputModeEnumSchema.enum.Consume).describe(
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
