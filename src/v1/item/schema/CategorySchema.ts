import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TitleSchema } from "~/v1/common/schema/TitleSchema";

/**
 * UI-facing category shared by items that should be presented together.
 *
 * Categories are embedded in items rather than maintained in a global catalog.
 * This keeps content grouping close to the items it affects while giving the UI
 * both a stable grouping key and a display title.
 */
export const CategorySchema = z
	.object({
		/**
		 * Stable key used by the UI to group related items.
		 */
		id: IdSchema.describe("The stable key used by the UI to group related items."),
		/**
		 * Human-readable name displayed for this item category.
		 */
		title: TitleSchema.describe("The human-readable name displayed for this item category."),
	})
	.strict()
	.describe("A UI-facing category used to group related game items.");

export type CategorySchema = typeof CategorySchema;

export namespace CategorySchema {
	export type Type = z.infer<CategorySchema>;
}
