import { z } from "zod";

import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { InputChargeRunPlanSchema } from "./InputChargeRunPlanSchema";

/**
 * One line-run input plan that owns no resource operation.
 */
export const InputSimpleRunPlanSchema = z
	.object({
		/**
		 * Identifies this plan as one simple input.
		 */
		type: InputEnumSchema.extract([
			"simple",
		]),
		charges: InputChargeRunPlanSchema.optional().describe(
			"The optional exact charge payment attached to this simple input.",
		),
	})
	.strict()
	.meta({
		id: "InputSimpleRunPlanSchema",
		description: "One simple line-run input plan with no resource operation.",
	});

export type InputSimpleRunPlanSchema = typeof InputSimpleRunPlanSchema;

export namespace InputSimpleRunPlanSchema {
	export type Type = z.infer<InputSimpleRunPlanSchema>;
}
