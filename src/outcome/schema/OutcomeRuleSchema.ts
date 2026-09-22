import { z } from "zod";

import { DisableOutcomeRuleSchema } from "./DisableOutcomeRuleSchema";
import { EnableOutcomeRuleSchema } from "./EnableOutcomeRuleSchema";

/**
 * An outcome availability rule used by outcome sets or selected outcomes.
 *
 * Each member owns its own behavior and fields. The `type` discriminator keeps
 * the union explicit and directly compatible with `ts-pattern`.
 */
export const OutcomeRuleSchema = z
	.discriminatedUnion("type", [
		EnableOutcomeRuleSchema,
		DisableOutcomeRuleSchema,
	])
	.meta({
		id: "outcome.RuleSchema",
		description: "An availability rule evaluated for an outcome candidate or outcome.",
	});

export type OutcomeRuleSchema = typeof OutcomeRuleSchema;

export namespace OutcomeRuleSchema {
	export type Type = z.infer<OutcomeRuleSchema>;
}
