import { z } from "zod";

import type { ActionInputSchema } from "~/engine/action/schema/ActionInputSchema";
import type { ActionRuleSchema } from "~/engine/action/schema/ActionRuleSchema";
import type { BaseItemSchema } from "~/engine/item/schema/BaseItemSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

/** Local presentation values owned only by one mounted item form. */
export type EditorItemFormValues = Omit<BaseItemSchema.Type, "merge"> & {
	readonly type: ItemEnumSchema.Type;
	readonly durationMs?: number;
	readonly enable?: boolean;
	readonly input?: ActionInputSchema.Type[];
	readonly line?: LineSchema.Type;
	readonly lines?: LineSchema.Type[];
	readonly maxQueueSize?: number;
	readonly merge?: MergeSchema.Type[];
	readonly output?: OutputSchema.Type;
	readonly rules?: ActionRuleSchema.Type[];
	readonly space?: number;
};

/**
 * Validates the local item-form representation and emits one canonical item.
 *
 * Blank required numbers remain `NaN`, so the canonical ItemSchema reports them
 * at their exact field path instead of silently coercing them to zero.
 */
export const EditorItemFormSchema = z
	.custom<EditorItemFormValues>()
	.transform((candidate, context) => {
		const result = ItemSchema.safeParse(candidate);
		if (result.success) return result.data;
		for (const issue of result.error.issues) {
			context.addIssue({
				code: "custom",
				message: issue.message,
				path: issue.path,
			});
		}
		return z.NEVER;
	});

export type EditorItemFormSchema = typeof EditorItemFormSchema;
