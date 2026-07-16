import { z } from "zod";

import { InputResolutionSchema } from "~/engine/input/schema/resolution/InputResolutionSchema";
import { InputRunPlanSchema } from "./InputRunPlanSchema";

/**
 * Current readiness and optional exact operation for one line input.
 */
export const InputRunResolutionSchema = z
	.object({
		/**
		 * Current read-only readiness of this input slot.
		 */
		resolution: InputResolutionSchema.describe(
			"The current read-only readiness of this input slot.",
		),
		/**
		 * Exact run operation when this input is ready.
		 */
		plan: InputRunPlanSchema.optional().describe(
			"The exact run operation, omitted while this input is not ready.",
		),
	})
	.strict()
	.meta({
		id: "InputRunResolutionSchema",
		description: "The current readiness and optional exact operation of one line input.",
	});

export type InputRunResolutionSchema = typeof InputRunResolutionSchema;

export namespace InputRunResolutionSchema {
	export type Type = z.infer<InputRunResolutionSchema>;
}
