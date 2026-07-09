import { z } from "zod";

/**
 * Fields shared by every rule evaluated for a product line.
 *
 * Specialized line-rule schemas spread `BaseRuleSchema.shape` to preserve this
 * common contract while adding their discriminator and rule-specific fields.
 */
export const BaseRuleSchema = z
	.object({})
	.strict()
	.describe("The common fields shared by every product-line rule.");

export type BaseRuleSchema = typeof BaseRuleSchema;

export namespace BaseRuleSchema {
	export type Type = z.infer<BaseRuleSchema>;
}
