import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";

/** Current readiness of one external charged-item input. */
export const InputDepositResolutionSchema = z
	.object({
		type: TypeSchema.extract([
			"Deposit",
		]),
		ready: z.boolean().describe("Whether one matching board target can pay the authored cost."),
		targetItemId: IdSchema.optional().describe(
			"The selected runtime target identity, omitted while no matching charged target is ready.",
		),
	})
	.strict()
	.meta({
		id: "InputDepositResolutionSchema",
		description: "The selected target and readiness of one external charged-item input.",
	});

export type InputDepositResolutionSchema = typeof InputDepositResolutionSchema;

export namespace InputDepositResolutionSchema {
	export type Type = z.infer<InputDepositResolutionSchema>;
}
