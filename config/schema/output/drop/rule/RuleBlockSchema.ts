import { z } from "zod";
import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that prevents a selected drop from being emitted.
 *
 * When this rule applies, the selected drop is discarded without rerolling or
 * choosing a replacement candidate.
 */
export const RuleBlockSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a block on emitting the selected drop.
		 */
		type: RuleEnumSchema.extract(["block"]).describe(
			"Identifies this rule as a block on emitting the selected drop.",
		),
	})
	.strict()
	.describe("A rule that prevents a selected drop from being emitted.");

export type RuleBlockSchema = typeof RuleBlockSchema;

export namespace RuleBlockSchema {
	export type Type = z.infer<RuleBlockSchema>;
}
