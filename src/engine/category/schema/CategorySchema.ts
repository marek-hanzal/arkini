import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TitleSchema } from "~/engine/common/schema/TitleSchema";

/**
 * Canonical UI-facing category shared by items that should be presented together.
 *
 * Game configuration indexes categories by this schema's ID, while items retain
 * only a `categoryId` reference. Keeping the ID here makes the category itself
 * the canonical source of truth rather than trusting its record key alone.
 */
export const CategorySchema = z
	.object({
		/**
		 * Stable canonical key used by the UI to group related items.
		 */
		id: IdSchema.describe("The stable canonical key used by the UI to group related items."),
		/**
		 * Human-readable name displayed for this item category.
		 */
		title: TitleSchema.describe("The human-readable name displayed for this item category."),
	})
	.strict()
	.meta({
		id: "CategorySchema",
		description: "A canonical UI-facing category used to group related game items.",
	});

export type CategorySchema = typeof CategorySchema;

export namespace CategorySchema {
	export type Type = z.infer<CategorySchema>;
}
