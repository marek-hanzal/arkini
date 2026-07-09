import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that makes an otherwise hidden product line visible.
 *
 * The rule's concrete condition fields will be added together with the local
 * line-rule condition model. Until then, this schema establishes the explicit
 * `show` discriminator used by the line-rule union.
 */
export const RuleShowSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a conditional request to show the line.
		 */
		type: RuleEnumSchema.extract(["show"]).describe(
			"Identifies this rule as a request to show the product line.",
		),
	})
	.strict()
	.describe("A rule that conditionally makes a product line visible.");

export type RuleShowSchema = typeof RuleShowSchema;

export namespace RuleShowSchema {
	export type Type = z.infer<RuleShowSchema>;
}
