import { z } from "zod";

import { RuleBlockSchema } from "./RuleBlockSchema";
import { RuleHideSchema } from "./RuleHideSchema";
import { RuleRequireSchema } from "./RuleRequireSchema";
import { RuleRuntimeMultiplierSchema } from "./RuleRuntimeMultiplierSchema";
import { RuleShowSchema } from "./RuleShowSchema";

/**
 * A rule evaluated for a product line.
 *
 * Each member owns its own behavior and fields. The `type` discriminator keeps
 * the union explicit and directly compatible with `ts-pattern`.
 */
export const RuleSchema = z
	.discriminatedUnion("type", [
		RuleShowSchema,
		RuleHideSchema,
		RuleBlockSchema,
		RuleRequireSchema,
		RuleRuntimeMultiplierSchema,
	])
	.meta({
		id: "LineRuleSchema",
		description: "A rule evaluated for a product line.",
	});

export type RuleSchema = typeof RuleSchema;

export namespace RuleSchema {
	export type Type = z.infer<RuleSchema>;
}
