import { z } from "zod";

import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { DescriptionSchema } from "~/game-value/schema/DescriptionSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { AssetSchema } from "./AssetSchema";
import { UnitsSchema } from "./UnitsSchema";

/**
 * Fields shared by every item configuration.
 *
 * Specialized item schemas spread `BaseSchema.shape` to preserve this common
 * contract while adding their discriminator and future type-specific fields.
 */
export const BaseSchema = z
	.object({
		/**
		 * Stable low-level identity of this canonical game item.
		 *
		 * The editor generates this CUID2 exactly once. Renaming the human-readable
		 * `id` never changes this identity.
		 */
		uid: IdSchema.describe("The immutable CUID2 identity of this canonical game item."),
		/**
		 * Stable authoring ID of this canonical game item.
		 */
		id: IdSchema.describe("The stable authoring ID of this canonical game item."),
		/**
		 * Human-readable title of this item.
		 */
		title: TitleSchema.describe("The human-readable title of this item."),
		/**
		 * Lightweight Editor authoring status with no gameplay semantics.
		 *
		 * Older item files omit this field and remain equivalent to an explicitly
		 * completed item.
		 */
		draft: z
			.boolean()
			.optional()
			.describe(
				"Whether this item still needs authoring work in the Editor; omitted means false.",
			),
		/**
		 * Optional human-readable explanation of this item's purpose.
		 */
		description: DescriptionSchema.optional().describe(
			"The optional human-readable explanation of this item's purpose.",
		),
		/**
		 * Visual asset definition used to render this item.
		 */
		asset: AssetSchema.describe("The visual asset definition used to render this item."),
		/**
		 * Part of game state in which this item may be stored.
		 */
		scope: StorageSchema.describe("The part of game state in which this item may be stored."),
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
		 * Optional finite unit supply initialized separately for each fresh item instance.
		 */
		units: UnitsSchema.optional().describe(
			"The optional supply of units, such as health, resource stock, or uses, and depletion output of each item instance.",
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
		id: "item.BaseSchema",
		description: "The common fields shared by every game item.",
	});

export type BaseSchema = typeof BaseSchema;

export namespace BaseSchema {
	export type Type = z.infer<BaseSchema>;
}
