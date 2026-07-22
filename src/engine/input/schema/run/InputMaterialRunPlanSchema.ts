import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";

import { InputRunItemPlanSchema } from "./InputRunItemPlanSchema";
import { InputChargeRunPlanSchema } from "./InputChargeRunPlanSchema";

/**
 * Exact buffered material allocation required by one line run.
 */
export const InputMaterialRunPlanSchema = z
	.object({
		/**
		 * Identifies this plan as one material input.
		 */
		type: InputEnumSchema.extract([
			InputEnumSchema.enum.Materials,
		]),
		/**
		 * Whether the allocated material is consumed or reserved by the run.
		 */
		mode: InputModeEnumSchema.describe(
			"Whether the allocated material is consumed or reserved by the line run.",
		),
		/**
		 * Total quantity allocated across every concrete buffered item.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The total positive quantity allocated across buffered runtime items.",
		),
		charges: InputChargeRunPlanSchema.optional().describe(
			"The optional exact charge payment attached to this material input.",
		),
		/**
		 * Ordered concrete item allocations whose quantity sums to `quantity`.
		 */
		item: z
			.tuple(
				[
					InputRunItemPlanSchema,
				],
				InputRunItemPlanSchema,
			)
			.describe("The ordered concrete buffered-item allocations used by this line run."),
	})
	.strict()
	.meta({
		id: "InputMaterialRunPlanSchema",
		description: "The exact buffered material allocation required by one line run.",
	});

export type InputMaterialRunPlanSchema = typeof InputMaterialRunPlanSchema;

export namespace InputMaterialRunPlanSchema {
	export type Type = z.infer<InputMaterialRunPlanSchema>;
}
