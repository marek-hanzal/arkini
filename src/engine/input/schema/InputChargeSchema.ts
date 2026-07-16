import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { InputChargeFromEnumSchema } from "./InputChargeFromEnumSchema";

/** Charge cost paid when one line input participates in an actual job start. */
export const InputChargeSchema = z
	.object({
		cost: PositiveIntegerSchema.describe(
			"The positive number of charges paid when this input starts one line job.",
		),
		from: InputChargeFromEnumSchema.describe(
			"Whether the cost is paid by the line owner or the input's resolved target.",
		),
	})
	.strict()
	.meta({
		id: "InputChargeSchema",
		description: "One line-input charge cost and the runtime item that pays it.",
	});

export type InputChargeSchema = typeof InputChargeSchema;

export namespace InputChargeSchema {
	export type Type = z.infer<InputChargeSchema>;
}
