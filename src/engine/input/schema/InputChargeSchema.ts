import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { InputChargeFromEnumSchema } from "./InputChargeFromEnumSchema";

/** Charge cost paid when one requirement participates in a committed action. */
export const InputChargeSchema = z
	.object({
		cost: PositiveIntegerSchema.describe(
			"The positive number of charges paid when the enclosing action commits.",
		),
		from: InputChargeFromEnumSchema.describe(
			"Whether the cost is paid by the action owner or the requirement's resolved target.",
		),
	})
	.strict()
	.meta({
		id: "InputChargeSchema",
		description: "One action-requirement charge cost and the runtime item that pays it.",
	});

export type InputChargeSchema = typeof InputChargeSchema;

export namespace InputChargeSchema {
	export type Type = z.infer<InputChargeSchema>;
}
