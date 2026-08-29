import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A rule that disables a selected drop when all of its conditions pass.
 *
 * An applicable disable rule vetoes emission. The selected drop is discarded
 * without rerolling or choosing a replacement candidate.
 */
export const DisableSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this rule as a disable veto for the selected drop.
		 */
		type: TypeSchema.extract([
			"Disable",
		]).describe("Identifies this rule as a disable veto for the selected drop."),
	})
	.strict()
	.meta({
		id: "drop.rule.DisableSchema",
		description: "A rule that disables a selected drop when its conditions pass.",
	});

export type DisableSchema = typeof DisableSchema;

export namespace DisableSchema {
	export type Type = z.infer<DisableSchema>;
}
