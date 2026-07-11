import { z } from "zod";

import { InputMaterialResolutionSchema } from "./InputMaterialResolutionSchema";
import { InputSimpleResolutionSchema } from "./InputSimpleResolutionSchema";

/**
 * Readiness of one implemented line-input kind.
 *
 * Deposit resolution is intentionally absent until deposit runtime capacity is
 * represented by its own state contract.
 */
export const InputResolutionSchema = z
	.discriminatedUnion("type", [
		InputSimpleResolutionSchema,
		InputMaterialResolutionSchema,
	])
	.meta({
		id: "InputResolutionSchema",
		description: "The readiness of one implemented simple or material input.",
	});

export type InputResolutionSchema = typeof InputResolutionSchema;

export namespace InputResolutionSchema {
	export type Type = z.infer<InputResolutionSchema>;
}
