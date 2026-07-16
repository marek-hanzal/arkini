import { z } from "zod";

import { InputMaterialRunPlanSchema } from "./InputMaterialRunPlanSchema";

/**
 * Optional exact material allocation for one input slot.
 *
 * `undefined` means that the buffered quantity is not ready for one run.
 */
export const InputMaterialRunPlanResolutionSchema = InputMaterialRunPlanSchema.optional().meta({
	id: "InputMaterialRunPlanResolutionSchema",
	description: "One exact material run plan, or undefined while the input is not ready.",
});

export type InputMaterialRunPlanResolutionSchema = typeof InputMaterialRunPlanResolutionSchema;

export namespace InputMaterialRunPlanResolutionSchema {
	export type Type = z.infer<InputMaterialRunPlanResolutionSchema>;
}
