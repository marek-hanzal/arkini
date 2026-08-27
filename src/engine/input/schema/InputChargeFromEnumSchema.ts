import { z } from "zod";

/** Selects the runtime item whose charges pay one action requirement. */
export const InputChargeFromEnumSchema = z
	.enum({
		Self: "self",
		Target: "target",
	})
	.meta({
		id: "InputChargeFromEnumSchema",
		description:
			"Whether one requirement cost is paid by the action owner or its resolved target.",
	});

export type InputChargeFromEnumSchema = typeof InputChargeFromEnumSchema;

export namespace InputChargeFromEnumSchema {
	export type Type = z.infer<InputChargeFromEnumSchema>;
}
