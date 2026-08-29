import { z } from "zod";

import type { InputSchema } from "~/production-action/schema/InputSchema";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import type { BaseSchema } from "~/engine/item/schema/BaseSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";

/** Local presentation values owned only by one mounted item form. */
export type EditorItemFormValues = Omit<BaseSchema.Type, "merge"> & {
	readonly type: TypeSchema.Type;
	readonly durationMs?: number;
	readonly enable?: boolean;
	readonly input?: InputSchema.Type[];
	readonly line?: LineSchema.Type;
	readonly lines?: LineSchema.Type[];
	readonly maxQueueSize?: number;
	readonly merge?: MergeSchema.Type[];
	readonly output?: OutputSchema.Type;
	readonly rules?: RuleSchema.Type[];
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
