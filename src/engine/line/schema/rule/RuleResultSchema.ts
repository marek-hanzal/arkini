import { z } from "zod";

import {
	ActionRuleDisableResultSchema,
	ActionRuleEnableResultSchema,
} from "~/engine/action/schema/ActionRuleResultSchema";
import { RuleHideResultSchema } from "./RuleHideResultSchema";
import { RuleRuntimeAdjustResultSchema } from "./RuleRuntimeAdjustResultSchema";
import { RuleRuntimeMultiplierResultSchema } from "./RuleRuntimeMultiplierResultSchema";
import { RuleShowResultSchema } from "./RuleShowResultSchema";

/**
 * Result of evaluating one product-line rule against the current runtime.
 */
export const RuleResultSchema = z
	.discriminatedUnion("type", [
		RuleShowResultSchema,
		RuleHideResultSchema,
		ActionRuleEnableResultSchema,
		ActionRuleDisableResultSchema,
		RuleRuntimeAdjustResultSchema,
		RuleRuntimeMultiplierResultSchema,
	])
	.meta({
		id: "LineRuleResultSchema",
		description: "The result of evaluating one product-line rule.",
	});

export type RuleResultSchema = typeof RuleResultSchema;

export namespace RuleResultSchema {
	export type Type = z.infer<RuleResultSchema>;
}
