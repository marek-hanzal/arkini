import { z } from "zod";

import { InputMaterialRunPlanSchema } from "./InputMaterialRunPlanSchema";
import { InputDepositRunPlanSchema } from "./InputDepositRunPlanSchema";
import { InputSimpleRunPlanSchema } from "./InputSimpleRunPlanSchema";

/**
 * Exact operation prepared for one line input.
 */
export const InputRunPlanSchema = z
	.discriminatedUnion("type", [
		InputSimpleRunPlanSchema,
		InputMaterialRunPlanSchema,
		InputDepositRunPlanSchema,
	])
	.meta({
		id: "InputRunPlanSchema",
		description:
			"The exact simple, material, or charged-target operation prepared for one line run.",
	});

export type InputRunPlanSchema = typeof InputRunPlanSchema;

export namespace InputRunPlanSchema {
	export type Type = z.infer<InputRunPlanSchema>;
}
