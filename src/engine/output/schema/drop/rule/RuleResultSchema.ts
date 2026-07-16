import { z } from "zod";

import { RuleDisableResultSchema } from "./RuleDisableResultSchema";
import { RuleEnableResultSchema } from "./RuleEnableResultSchema";

/**
 * Result of evaluating one selected-drop rule against the current runtime.
 */
export const RuleResultSchema = z
	.discriminatedUnion("type", [
		RuleEnableResultSchema,
		RuleDisableResultSchema,
	])
	.meta({
		id: "DropRuleResultSchema",
		description: "The result of evaluating one selected-drop rule.",
	});

export type RuleResultSchema = typeof RuleResultSchema;

export namespace RuleResultSchema {
	export type Type = z.infer<RuleResultSchema>;
}
