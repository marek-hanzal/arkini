import { z } from "zod";

/**
 * Where the rule searches for matching items.
 */
export const RuleScopeSchema = z
	.enum([
		"board",
		"owned",
		"inventory",
	])
	.describe("Where the rule searches for matching items.");

export type RuleScopeSchema = typeof RuleScopeSchema;

export namespace RuleScopeSchema {
	export type Type = z.infer<RuleScopeSchema>;
}
