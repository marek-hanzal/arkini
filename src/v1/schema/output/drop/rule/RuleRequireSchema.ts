import { z } from "zod";
import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that requires a condition before a selected drop can be emitted.
 *
 * A failed requirement removes this drop from the successful roll's output; it
 * does not cause another drop candidate to be selected in its place.
 */
export const RuleRequireSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a requirement for emitting the selected drop.
		 */
		type: RuleEnumSchema.extract([
			"require",
		]).describe("Identifies this rule as a requirement for emitting the selected drop."),
	})
	.strict()
	.describe("A rule that requires a condition before a selected drop can be emitted.");

export type RuleRequireSchema = typeof RuleRequireSchema;

export namespace RuleRequireSchema {
	export type Type = z.infer<RuleRequireSchema>;
}
