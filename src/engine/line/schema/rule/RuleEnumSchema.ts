import { z } from "zod";

/**
 * Discriminates the rules evaluated for a product line.
 */
export const RuleEnumSchema = z
	.enum([
		/**
		 * Makes a line visible when the rule's condition is satisfied.
		 */
		"show",
		/**
		 * Hides a line when the rule's condition is satisfied.
		 */
		"hide",
		/**
		 * Enables a line when the rule's condition is satisfied.
		 */
		"enable",
		/**
		 * Disables a line when the rule's condition is satisfied.
		 */
		"disable",
		/**
		 * Multiplies a line's runtime when the rule's condition is satisfied.
		 */
		"runtime:multiplier",
	])
	.meta({
		id: "LineRuleEnumSchema",
		description: "The kind of rule evaluated for a product line.",
	});

export type RuleEnumSchema = typeof RuleEnumSchema;

export namespace RuleEnumSchema {
	export type Type = z.infer<RuleEnumSchema>;
}
