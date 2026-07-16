import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import { QuantityBoundsSchema } from "~/engine/quantity/schema/QuantityBoundsSchema";

/**
 * Current readiness and storage limits of one material input slot.
 */
export const InputMaterialResolutionSchema = z
	.object({
		/**
		 * Identifies this resolution as one material input.
		 */
		type: InputEnumSchema.extract([
			"materials",
		]),
		/**
		 * Whether the resolved material is consumed or reserved by a line run.
		 */
		mode: InputModeEnumSchema.describe(
			"Whether one ready line run consumes or reserves the resolved material.",
		),
		/**
		 * Inclusive quantity accepted by one line run.
		 */
		required: QuantityBoundsSchema.describe(
			"The inclusive material quantity accepted by one line run.",
		),
		/**
		 * Material quantity currently buffered in this input slot.
		 */
		storedQuantity: NonNegativeIntegerSchema.describe(
			"The material quantity currently buffered in this input slot.",
		),
		/**
		 * Largest total quantity this input slot may buffer.
		 */
		maxStoredQuantity: PositiveIntegerSchema.describe(
			"The largest total quantity this input slot may buffer.",
		),
		/**
		 * Quantity used by the next line run, or zero while the input is not ready.
		 */
		runQuantity: NonNegativeIntegerSchema.describe(
			"The quantity used by the next line run, or zero while the input is not ready.",
		),
		/**
		 * Additional quantity required before the input becomes ready.
		 */
		missingQuantity: NonNegativeIntegerSchema.describe(
			"The additional quantity required before this input becomes ready.",
		),
		/**
		 * Additional quantity this input slot can accept right now.
		 */
		availableCapacity: NonNegativeIntegerSchema.describe(
			"The additional quantity this input slot can accept right now.",
		),
		/**
		 * Whether enough material is buffered for one line run.
		 */
		ready: z.boolean().describe("Whether enough material is buffered for one line run."),
	})
	.strict()
	.meta({
		id: "InputMaterialResolutionSchema",
		description: "The current readiness and storage limits of one material input slot.",
	});

export type InputMaterialResolutionSchema = typeof InputMaterialResolutionSchema;

export namespace InputMaterialResolutionSchema {
	export type Type = z.infer<InputMaterialResolutionSchema>;
}
