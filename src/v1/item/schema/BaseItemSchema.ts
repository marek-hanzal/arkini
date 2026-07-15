import { z } from "zod";

import { StorageScopeEnumSchema } from "~/v1/scope/schema/StorageScopeEnumSchema";
import { DescriptionSchema } from "~/v1/common/schema/DescriptionSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { TitleSchema } from "~/v1/common/schema/TitleSchema";
import { MergeSchema } from "~/v1/merge/schema/MergeSchema";
import { TagSchema } from "~/v1/tag/schema/TagSchema";
import { AssetSchema } from "./AssetSchema";
import { ChargeSchema } from "./ChargeSchema";

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
		 * ID of the canonical UI-facing group shared with similar items.
		 */
		categoryId: IdSchema.describe(
			"The ID of the canonical UI-facing group shared with similar items.",
		),
		/**
		 * Part of game state in which this item may be stored.
		 */
		scope: StorageScopeEnumSchema.describe(
			"The part of game state in which this item may be stored.",
		),
		/**
		 * Optional maximum number of this item allowed across the game state.
		 */
		maxCount: PositiveIntegerSchema.optional().describe(
			"The optional maximum number of this item allowed across the game state.",
		),
		/**
		 * Maximum number of this item that one stack can hold.
		 *
		 * Runtime keeps an item with mutable state, such as craft progress, in an
		 * individual stack even when this configured limit is greater than one.
		 */
		maxStackSize: PositiveIntegerSchema.describe(
			"The maximum number of this item that one stack can hold before it has mutable state.",
		),
		/**
		 * Optional finite lifetime shared by every fresh instance of this item.
		 */
		charges: ChargeSchema.optional().describe(
			"The optional finite lifetime and depletion output of each item instance.",
		),
		/**
		 * Optional target-specific merges initiated when this item is dropped onto another item.
		 */
		merge: z
			.tuple(
				[
					MergeSchema,
				],
				MergeSchema,
			)
			.optional()
			.describe(
				"The optional non-empty target-specific merges initiated when this item is dropped onto another item.",
			),
	})
	.strict()
	.meta({
		id: "BaseItemSchema",
		description: "The common fields shared by every game item.",
	});

export type BaseItemSchema = typeof BaseItemSchema;

export namespace BaseItemSchema {
	export type Type = z.infer<BaseItemSchema>;
}
