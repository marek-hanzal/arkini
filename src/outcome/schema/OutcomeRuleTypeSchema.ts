import { z } from "zod";

/**
 * Discriminates the rules evaluated after a roll selects a outcome.
 */
export const OutcomeRuleTypeSchema = z
	.enum({
		Enable: "enable",
		Disable: "disable",
	})
	.meta({
		id: "outcome.rule.TypeSchema",
		description: "The kind of availability rule evaluated for a selected outcome.",
	});

export type OutcomeRuleTypeSchema = typeof OutcomeRuleTypeSchema;

export namespace OutcomeRuleTypeSchema {
	export type Type = z.infer<OutcomeRuleTypeSchema>;
}
