import { z } from "zod";

/**
 * Discriminates the rules evaluated after a roll selects a drop.
 */
export const RuleEnumSchema = z
	.enum([
		/**
		 * Enables the selected drop only when the rule's conditions pass.
		 */
		"enable",
		/**
		 * Disables the selected drop when the rule's conditions pass.
		 */
		"disable",
	])
	.meta({
		id: "DropRuleEnumSchema",
		description: "The kind of availability rule evaluated for a selected drop.",
	});

export type RuleEnumSchema = typeof RuleEnumSchema;

export namespace RuleEnumSchema {
	export type Type = z.infer<RuleEnumSchema>;
}
