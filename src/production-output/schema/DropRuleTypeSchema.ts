import { z } from "zod";

/**
 * Discriminates the rules evaluated after a roll selects a drop.
 */
export const DropRuleTypeSchema = z
	.enum({
		Enable: "enable",
		Disable: "disable",
	})
	.meta({
		id: "drop.rule.TypeSchema",
		description: "The kind of availability rule evaluated for a selected drop.",
	});

export type DropRuleTypeSchema = typeof DropRuleTypeSchema;

export namespace DropRuleTypeSchema {
	export type Type = z.infer<DropRuleTypeSchema>;
}
