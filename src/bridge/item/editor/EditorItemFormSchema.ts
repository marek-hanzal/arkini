import { z } from "zod";

import type { BaseItemSchema } from "~/engine/item/schema/BaseItemSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

/** Local presentation values owned only by one mounted item form. */
export type EditorItemFormValues = Omit<BaseItemSchema.Type, "merge" | "tags"> & {
	readonly tags: string;
	readonly type: ItemEnumSchema.Type;
	readonly durationMs?: number;
	readonly line?: LineSchema.Type;
	readonly lines?: LineSchema.Type[];
	readonly maxQueueSize?: number;
	readonly merge?: MergeSchema.Type[];
	readonly output?: OutputSchema.Type;
};

/**
 * Validates the local item-form representation and emits one canonical item.
 *
 * Tags remain one editable comma-separated string in the form store. Blank
 * required numbers remain `NaN`, so the canonical ItemSchema reports them at
 * their exact field path instead of silently coercing them to zero.
 */
export const EditorItemFormSchema = z
	.custom<EditorItemFormValues>(
		(candidate) =>
			typeof candidate === "object" &&
			candidate !== null &&
			!Array.isArray(candidate) &&
			typeof (candidate as Readonly<Record<string, unknown>>).tags === "string",
		{
			error: "Item form values must contain an editable tags string.",
		},
	)
	.transform((candidate) => ({
		candidate,
		tags: candidate.tags
			.split(",")
			.map((tag) => tag.trim())
			.filter((tag) => tag !== ""),
	}))
	.transform(({ candidate, tags }, context) => {
		const result = ItemSchema.safeParse({
			...candidate,
			tags,
		});
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
