import { z } from "zod";

/**
 * Discriminates the rules evaluated for a product line.
 */
export const RuleEnumSchema = z
	.enum({
		Show: "show",
		Hide: "hide",
		Enable: "enable",
		Disable: "disable",
		RuntimeMultiplier: "runtime:multiplier",
	})
	.meta({
		id: "LineRuleEnumSchema",
		description: "The kind of rule evaluated for a product line.",
	});

export type RuleEnumSchema = typeof RuleEnumSchema;

export namespace RuleEnumSchema {
	export type Type = z.infer<RuleEnumSchema>;
}
