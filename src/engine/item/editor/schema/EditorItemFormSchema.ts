import { z } from "zod";

import type { BaseItemSchema } from "~/engine/item/schema/BaseItemSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

/** Local presentation values owned only by one mounted item form. */
export type EditorItemFormValues = Omit<
	BaseItemSchema.Type,
	"merge" | "tags"
> & {
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
export const EditorItemFormSchema = z.preprocess<
	z.input<typeof ItemSchema>,
	typeof ItemSchema,
	EditorItemFormValues
>(
	(candidate) => {
		if (
			typeof candidate !== "object" ||
			candidate === null ||
			Array.isArray(candidate)
		) {
			return candidate as z.input<typeof ItemSchema>;
		}
		const record = candidate as Readonly<Record<string, unknown>>;
		if (typeof record.tags !== "string") {
			return candidate as z.input<typeof ItemSchema>;
		}
		return {
			...record,
			tags: record.tags
				.split(",")
				.map((tag) => tag.trim())
				.filter((tag) => tag !== ""),
		} as z.input<typeof ItemSchema>;
	},
	ItemSchema,
);

export type EditorItemFormSchema = typeof EditorItemFormSchema;
