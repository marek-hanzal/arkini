import { z } from "zod";

import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import { DescriptionSchema } from "~/v1/common/schema/DescriptionSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { TitleSchema } from "~/v1/common/schema/TitleSchema";
import { MergeSchema } from "~/v1/merge/schema/MergeSchema";
import { AssetSchema } from "./AssetSchema";
import { CategorySchema } from "./CategorySchema";
import { TagSchema } from "./TagSchema";

/**
 * Fields shared by every item configuration.
 *
 * Specialized item schemas spread `BaseItemSchema.shape` to preserve this common
 * contract while adding their discriminator and future type-specific fields.
 */
export const BaseItemSchema = z
	.object({
		/**
		 * Stable ID of this canonical game item.
		 */
		id: IdSchema.describe("The stable ID of this canonical game item."),
		/**
		 * Human-readable title of this item.
		 */
		title: TitleSchema.describe("The human-readable title of this item."),
		/**
		 * Human-readable explanation of this item's purpose.
		 */
		description: DescriptionSchema.describe(
			"The human-readable explanation of this item's purpose.",
		),
		/**
		 * Visual asset definition used to render this item.
		 */
		asset: AssetSchema.describe("The visual asset definition used to render this item."),
		/**
		 * Semantic labels used to classify this item for content and future rules.
		 */
		tags: z
			.array(TagSchema)
			.describe(
				"The semantic labels used to classify this item for content and future rules.",
			),
		/**
		 * UI-facing group shared with similar items.
		 */
		category: CategorySchema.describe("The UI-facing group shared with similar items."),
		/**
		 * Part of game state in which this item may be stored.
		 */
		scope: ScopeEnumSchema.describe("The part of game state in which this item may be stored."),
		/**
		 * Optional maximum number of this item allowed across the game state.
		 */
		maxCount: PositiveIntegerSchema.optional().describe(
			"The optional maximum number of this item allowed across the game state.",
		),
		/**
		 * Optional directional merge initiated when this item is dropped onto another item.
		 */
		merge: MergeSchema.optional().describe(
			"The optional directional merge initiated when this item is dropped onto another item.",
		),
	})
	.strict()
	.describe("The common fields shared by every game item.");

export type BaseItemSchema = typeof BaseItemSchema;

export namespace BaseItemSchema {
	export type Type = z.infer<BaseItemSchema>;
}
