import { z } from "zod";

import { ScopeEnumSchema } from "../../scope/schema/ScopeEnumSchema";
import { IdSchema } from "../../common/schema/IdSchema";
import { PositiveIntegerSchema } from "../../common/schema/PositiveIntegerSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A condition that checks the count of one item in a game-state scope.
 *
 * The condition is satisfied when the matching item count is greater than or
 * equal to `count`.
 */
export const WhenCountSchema = z
	.object({
		/**
		 * Identifies this condition as a game-state item-count check.
		 */
		type: WhenEnumSchema.extract([
			"count",
		]).describe("Identifies this condition as a game-state item-count check."),
		/**
		 * ID of the item whose count is checked.
		 */
		itemId: IdSchema.describe("The ID of the item whose count is checked."),
		/**
		 * Part of the game state searched for matching items.
		 */
		scope: ScopeEnumSchema.describe("The part of the game state searched for matching items."),
		/**
		 * Minimum number of matching items required for this condition to pass.
		 */
		count: PositiveIntegerSchema.describe(
			"The minimum number of matching items required for this condition to pass.",
		),
	})
	.strict()
	.describe("A condition that checks the count of one item in a game-state scope.");

export type WhenCountSchema = typeof WhenCountSchema;

export namespace WhenCountSchema {
	export type Type = z.infer<WhenCountSchema>;
}
