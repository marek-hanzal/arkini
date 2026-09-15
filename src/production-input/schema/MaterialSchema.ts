import { z } from "zod";

import { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import { SelectorSchema } from "~/item-definition/schema/SelectorSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";
import { ModeSchema } from "./ModeSchema";

/**
 * A directly delivered material item required by a product line.
 *
 * The matching items are committed to the active job. `consume` destroys passive
 * owned state at start and discards the committed root at completion; `reserve`
 * retains the same live instance and relocates it after completion. Quantity
 * aggregates every item matched by the selector.
 */
export const MaterialSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this input as a directly delivered material item.
		 */
		type: TypeSchema.extract([
			"Materials",
		]).describe("Identifies this input as a directly delivered material item."),
		/**
		 * Canonical item accepted by this input.
		 */
		selector: SelectorSchema.describe("The canonical item accepted by this input."),
		/**
		 * Whether this input is consumed or temporarily reserved by the line.
		 *
		 * A reserved input retains the same live instance in reserved scope and uses
		 * canonical existing-item placement when work completes. A consumed input
		 * discards passive owned state when the job starts and its committed root when
		 * the job completes. Expired material may abort an active job whose
		 * remaining committed quantity no longer satisfies this input's minimum.
		 */
		mode: ModeSchema.default(ModeSchema.enum.Consume).describe(
			"Whether this input is consumed or reserved; defaults to consume.",
		),
		/**
		 * Exact or bounded total amount accepted by this input.
		 *
		 * The amount aggregates every material item that matches this selector. A
		 * range quantity expresses the optional amount above the required minimum.
		 */
		quantity: QuantitySchema.describe(
			"The exact or bounded total amount accepted across all matching materials.",
		),
	})
	.strict()
	.meta({
		id: "input.MaterialSchema",
		description: "A directly delivered material item required by a product line.",
	});

export type MaterialSchema = typeof MaterialSchema;

export namespace MaterialSchema {
	export type Type = z.infer<MaterialSchema>;
}
