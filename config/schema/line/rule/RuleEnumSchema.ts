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
		 * Prevents a visible line from starting when the rule's condition is satisfied.
		 */
		"block",
		/**
		 * Requires the rule's condition to be satisfied before a visible line can start.
		 */
		"require",
	])
	.describe("The kind of rule evaluated for a product line.");

export type RuleEnumSchema = typeof RuleEnumSchema;

export namespace RuleEnumSchema {
	export type Type = z.infer<RuleEnumSchema>;
}
