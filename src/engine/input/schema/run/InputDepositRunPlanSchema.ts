import { z } from "zod";

import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

import { InputChargeRunPlanSchema } from "./InputChargeRunPlanSchema";

/** Exact external charged-item target used by one deposit input. */
export const InputDepositRunPlanSchema = z
	.object({
		type: InputEnumSchema.extract(["Deposit"]),
		charges: InputChargeRunPlanSchema.describe(
			"The exact external charged item and cost paid by this deposit input.",
		),
	})
	.strict()
	.meta({
		id: "InputDepositRunPlanSchema",
		description: "The exact charged board target used by one deposit input.",
	});

export type InputDepositRunPlanSchema = typeof InputDepositRunPlanSchema;

export namespace InputDepositRunPlanSchema {
	export type Type = z.infer<InputDepositRunPlanSchema>;
}
