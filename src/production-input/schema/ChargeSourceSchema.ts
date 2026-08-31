import { z } from "zod";

/** Selects the runtime item whose charges pay one action requirement. */
export const ChargeSourceSchema = z
	.enum({
		Self: "self",
		Target: "target",
	})
	.meta({
		id: "input.ChargeSourceSchema",
		description:
			"Whether one requirement cost is paid by the action owner or its resolved target.",
	});

export type ChargeSourceSchema = typeof ChargeSourceSchema;

export namespace ChargeSourceSchema {
	export type Type = z.infer<ChargeSourceSchema>;
}
