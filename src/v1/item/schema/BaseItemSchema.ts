import { z } from "zod";

import { ScopeEnumSchema } from "../../scope/schema/ScopeEnumSchema";
import { DescriptionSchema } from "../../common/schema/DescriptionSchema";
import { IdSchema } from "../../common/schema/IdSchema";
import { PositiveIntegerSchema } from "../../common/schema/PositiveIntegerSchema";
import { TitleSchema } from "../../common/schema/TitleSchema";

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
		 * Part of game state in which this item may be stored.
		 */
		scope: ScopeEnumSchema.describe("The part of game state in which this item may be stored."),
		/**
		 * Optional maximum number of this item allowed across the game state.
		 */
		maxCount: PositiveIntegerSchema.optional().describe(
			"The optional maximum number of this item allowed across the game state.",
		),
	})
	.strict()
	.describe("The common fields shared by every game item.");

export type BaseItemSchema = typeof BaseItemSchema;

export namespace BaseItemSchema {
	export type Type = z.infer<BaseItemSchema>;
}
