import { z } from "zod";

import { InputMaterialRunPlanSchema } from "./InputMaterialRunPlanSchema";
import { InputSimpleRunPlanSchema } from "./InputSimpleRunPlanSchema";

/**
 * Exact operation prepared for one implemented line input.
 *
 * Deposit plans remain intentionally absent until deposit runtime capacity has
 * its own state contract.
 */
export const InputRunPlanSchema = z
	.discriminatedUnion("type", [
		InputSimpleRunPlanSchema,
		InputMaterialRunPlanSchema,
	])
	.meta({
		id: "InputRunPlanSchema",
		description: "The exact simple or material operation prepared for one line run.",
	});

export type InputRunPlanSchema = typeof InputRunPlanSchema;

export namespace InputRunPlanSchema {
	export type Type = z.infer<InputRunPlanSchema>;
}
