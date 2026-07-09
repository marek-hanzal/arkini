import { z } from "zod";

/**
 * Discriminates the rules evaluated after a roll selects a drop.
 */
export const RuleEnumSchema = z
	.enum([
		/**
		 * Requires the rule's condition to be satisfied before the selected drop can be emitted.
		 */
		"require",
		/**
		 * Prevents the selected drop from being emitted when the rule's condition is satisfied.
		 */
		"block",
	])
	.meta({
		id: "DropRuleEnumSchema",
		description: "The kind of rule evaluated for a selected drop.",
	});

export type RuleEnumSchema = typeof RuleEnumSchema;

export namespace RuleEnumSchema {
	export type Type = z.infer<RuleEnumSchema>;
}
