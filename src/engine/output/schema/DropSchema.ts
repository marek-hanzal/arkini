import { z } from "zod";

import { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { RuleSchema } from "./drop/rule/RuleSchema";
import { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";

/**
 * A quantity of a canonical game item emitted by a successful roll.
 *
 * Drops reference the item catalog by ID instead of embedding a duplicate item
 * definition, which keeps item behavior and cross-reference validation central.
 */
export const DropSchema = z
	.object({
		/**
		 * ID of the canonical game item emitted by this drop.
		 */
		itemId: IdSchema.describe("The ID of the canonical game item emitted by this drop."),
		/**
		 * Number of this item emitted by the drop.
		 */
		quantity: QuantitySchema.describe("The quantity emitted by this drop."),
		/**
		 * Board-placement strategy used after this drop is resolved.
		 *
		 * The default local drop searches from the source by Manhattan distance.
		 * Regardless of the selected strategy, runtime first checks board capacity.
		 * If the board cannot accept the emitted items, their item scope determines
		 * whether the remainder may be placed in inventory.
		 */
		placement: PlacementEnumSchema.default("drop").describe(
			"The board-placement strategy for this drop; defaults to a local Manhattan-distance drop and does not control scope-based inventory fallback.",
		),
		/**
		 * Rules evaluated after this drop is selected by a successful roll.
		 *
		 * Every `enable` rule must pass and any applicable `disable` rule prevents
		 * this drop from being emitted. Rejection does not reroll or replace it.
		 */
		rules: z
			.array(RuleSchema)
			.describe("Rules evaluated after this drop is selected by a successful roll."),
	})
	.strict()
	.meta({
		id: "DropSchema",
		description:
			"A canonical game item, quantity, board-placement strategy, and rules for a successful roll's drop.",
	});

export type DropSchema = typeof DropSchema;

export namespace DropSchema {
	export type Type = z.infer<DropSchema>;
}
