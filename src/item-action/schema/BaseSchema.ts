import { z } from "zod";
import { InputSchema } from "~/production-action/schema/InputSchema";
import { RuleSchema } from "~/production-action/schema/RuleSchema";

/** Requirements shared by every immediate item action; empty rules allow activation. */
export const BaseSchema = z
	.object({
		input: z.array(InputSchema).default([]),
		rules: z.array(RuleSchema).default([]),
	})
	.strict()
	.meta({
		id: "itemAction.BaseSchema",
		description: "Immediate item-action requirements and availability rules.",
	});
export type BaseSchema = typeof BaseSchema;
export namespace BaseSchema {
	export type Type = z.infer<BaseSchema>;
}
