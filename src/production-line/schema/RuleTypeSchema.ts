import { z } from "zod";

/**
 * Discriminates the rules evaluated for a product line.
 */
export const RuleTypeSchema = z
	.enum({
		Show: "show",
		Hide: "hide",
		Enable: "enable",
		Disable: "disable",
		RuntimeAdjust: "runtime:adjust",
		RuntimeMultiplier: "runtime:multiplier",
	})
	.meta({
		id: "line.rule.TypeSchema",
		description: "The kind of rule evaluated for a product line.",
	});

export type RuleTypeSchema = typeof RuleTypeSchema;

export namespace RuleTypeSchema {
	export type Type = z.infer<RuleTypeSchema>;
}
