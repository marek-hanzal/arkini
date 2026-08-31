import { z } from "zod";

import { DisableRuleSchema } from "./DisableRuleSchema";
import { EnableRuleSchema } from "./EnableRuleSchema";

/** Availability rules meaningful to an immediate item action. */
export const RuleSchema = z
	.discriminatedUnion("type", [
		EnableRuleSchema,
		DisableRuleSchema,
	])
	.meta({
		id: "action.RuleSchema",
		description: "Enable gates and disable vetoes evaluated for an immediate item action.",
	});

export type RuleSchema = typeof RuleSchema;

export namespace RuleSchema {
	export type Type = z.infer<RuleSchema>;
}
