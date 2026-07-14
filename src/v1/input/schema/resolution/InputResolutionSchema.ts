import { z } from "zod";

import { InputMaterialResolutionSchema } from "./InputMaterialResolutionSchema";
import { InputDepositResolutionSchema } from "./InputDepositResolutionSchema";
import { InputSimpleResolutionSchema } from "./InputSimpleResolutionSchema";

/**
 * Readiness of one implemented line-input kind.
 */
export const InputResolutionSchema = z
	.discriminatedUnion("type", [
		InputSimpleResolutionSchema,
		InputMaterialResolutionSchema,
		InputDepositResolutionSchema,
	])
	.meta({
		id: "InputResolutionSchema",
		description: "The readiness of one simple, material, or external charged-item input.",
	});

export type InputResolutionSchema = typeof InputResolutionSchema;

export namespace InputResolutionSchema {
	export type Type = z.infer<InputResolutionSchema>;
}
