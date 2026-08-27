import { z } from "zod";

import { ActionRuleDisableSchema } from "./ActionRuleDisableSchema";
import { ActionRuleEnableSchema } from "./ActionRuleEnableSchema";

/** Availability rules meaningful to an immediate item action. */
export const ActionRuleSchema = z
	.discriminatedUnion("type", [
		ActionRuleEnableSchema,
		ActionRuleDisableSchema,
	])
	.meta({
		id: "ActionRuleSchema",
		description: "Enable gates and disable vetoes evaluated for an immediate item action.",
	});

export type ActionRuleSchema = typeof ActionRuleSchema;

export namespace ActionRuleSchema {
	export type Type = z.infer<ActionRuleSchema>;
}
