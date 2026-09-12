import { z } from "zod";

/** Selects the runtime item whose units pay one action requirement. */
export const UnitSourceSchema = z
	.enum({
		Self: "self",
		Target: "target",
	})
	.meta({
		id: "input.UnitSourceSchema",
		description:
			"Whether one requirement cost is paid by the action owner or its resolved target.",
	});

export type UnitSourceSchema = typeof UnitSourceSchema;

export namespace UnitSourceSchema {
	export type Type = z.infer<UnitSourceSchema>;
}
