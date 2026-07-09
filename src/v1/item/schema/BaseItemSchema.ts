import { z } from "zod";

import { ScopeEnumSchema } from "../scope/ScopeEnumSchema";
import { IdSchema } from "../util/IdSchema";
import { PositiveIntegerSchema } from "../util/PositiveIntegerSchema";

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
