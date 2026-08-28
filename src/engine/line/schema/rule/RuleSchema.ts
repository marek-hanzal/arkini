import { z } from "zod";

import { DisableRuleSchema } from "~/engine/action/schema/DisableRuleSchema";
import { EnableRuleSchema } from "~/engine/action/schema/EnableRuleSchema";
import { HideSchema } from "./HideSchema";
import { RuntimeAdjustmentSchema } from "./RuntimeAdjustmentSchema";
import { RuntimeMultiplierSchema } from "./RuntimeMultiplierSchema";
import { ShowSchema } from "./ShowSchema";

/**
 * A rule evaluated for a product line.
 *
 * Each member owns its own behavior and fields. The `type` discriminator keeps
 * the union explicit and directly compatible with `ts-pattern`.
 */
export const RuleSchema = z
	.discriminatedUnion("type", [
		ShowSchema,
		HideSchema,
		EnableRuleSchema,
		DisableRuleSchema,
		RuntimeAdjustmentSchema,
		RuntimeMultiplierSchema,
	])
	.meta({
		id: "line.RuleSchema",
		description: "A rule evaluated for a product line.",
	});

export type RuleSchema = typeof RuleSchema;

export namespace RuleSchema {
	export type Type = z.infer<RuleSchema>;
}
