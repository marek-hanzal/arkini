import { z } from "zod";

/** Selects the runtime item whose charges pay one input cost. */
export const InputChargeFromEnumSchema = z
	.enum([
		"self",
		"target",
	])
	.meta({
		id: "InputChargeFromEnumSchema",
		description:
			"Whether one input charge cost is paid by the line owner or its resolved target.",
	});

export type InputChargeFromEnumSchema = typeof InputChargeFromEnumSchema;

export namespace InputChargeFromEnumSchema {
	export type Type = z.infer<InputChargeFromEnumSchema>;
}
