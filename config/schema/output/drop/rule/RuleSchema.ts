import { z } from "zod";

import { RuleBlockSchema } from "./RuleBlockSchema";
import { RuleRequireSchema } from "./RuleRequireSchema";

/**
 * A rule evaluated for a drop selected by a successful roll.
 *
 * Each member owns its own behavior and fields. The `type` discriminator keeps
 * the union explicit and directly compatible with `ts-pattern`.
 */
export const RuleSchema = z
	.discriminatedUnion("type", [
		RuleRequireSchema,
		RuleBlockSchema,
	])
	.describe("A rule evaluated for a drop selected by a successful roll.");

export type RuleSchema = typeof RuleSchema;

export namespace RuleSchema {
	export type Type = z.infer<RuleSchema>;
}
