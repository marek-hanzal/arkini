import { z } from "zod";

/**
 * Fields shared by every evaluated selected-drop rule result.
 */
export const BaseRuleResultSchema = z
	.object({
		/**
		 * Whether every condition owned by this rule passed.
		 */
		active: z
			.boolean()
			.describe("Whether every condition owned by this selected-drop rule passed."),
	})
	.strict()
	.meta({
		id: "BaseDropRuleResultSchema",
		description: "The common fields shared by every evaluated selected-drop rule result.",
	});

export type BaseRuleResultSchema = typeof BaseRuleResultSchema;

export namespace BaseRuleResultSchema {
	export type Type = z.infer<BaseRuleResultSchema>;
}
