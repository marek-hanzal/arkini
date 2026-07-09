import { z } from "zod";

import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A condition that checks the count of selected items in a game-state scope.
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
		 * Strategy used to select the items whose count is checked.
		 */
		selector: SelectorSchema.describe(
			"The strategy used to select the items whose count is checked.",
		),
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
	.meta({
		id: "WhenCountSchema",
		description: "A condition that checks the count of selected items in a game-state scope.",
	});

export type WhenCountSchema = typeof WhenCountSchema;

export namespace WhenCountSchema {
	export type Type = z.infer<WhenCountSchema>;
}
