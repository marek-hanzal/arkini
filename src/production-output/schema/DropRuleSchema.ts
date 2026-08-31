import { z } from "zod";

import { DisableDropRuleSchema } from "./DisableDropRuleSchema";
import { EnableDropRuleSchema } from "./EnableDropRuleSchema";

/**
 * An availability rule evaluated for a drop selected by a successful roll.
 *
 * Each member owns its own behavior and fields. The `type` discriminator keeps
 * the union explicit and directly compatible with `ts-pattern`.
 */
export const DropRuleSchema = z
	.discriminatedUnion("type", [
		EnableDropRuleSchema,
		DisableDropRuleSchema,
	])
	.meta({
		id: "drop.RuleSchema",
		description: "An availability rule evaluated for a selected drop.",
	});

export type DropRuleSchema = typeof DropRuleSchema;

export namespace DropRuleSchema {
	export type Type = z.infer<DropRuleSchema>;
}
