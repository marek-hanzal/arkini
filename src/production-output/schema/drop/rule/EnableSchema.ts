import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A rule that enables a selected drop only when all of its conditions pass.
 *
 * Every configured enable rule is a positive emission gate. A failed gate
 * discards the selected drop without rerolling or choosing a replacement.
 */
export const EnableSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this rule as an enable gate for the selected drop.
		 */
		type: TypeSchema.extract([
			"Enable",
		]).describe("Identifies this rule as an enable gate for the selected drop."),
	})
	.strict()
	.meta({
		id: "drop.rule.EnableSchema",
		description: "A rule that enables a selected drop when its conditions pass.",
	});

export type EnableSchema = typeof EnableSchema;

export namespace EnableSchema {
	export type Type = z.infer<EnableSchema>;
}
