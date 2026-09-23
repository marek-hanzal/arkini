import { z } from "zod";
import { OutcomeEnumSchema } from "./OutcomeEnumSchema";

import { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";

import { OutcomeRuleSchema } from "./OutcomeRuleSchema";

/**
 * A quantity of a canonical game item emitted by a successful roll.
 *
 * Outcomes reference the item catalog by ID instead of embedding a duplicate item
 * definition, which keeps item behavior and cross-reference validation central.
 */
export const ItemOutcomeSchema = z
	.object({
		type: OutcomeEnumSchema.extract([
			"Item",
		]),
		/**
		 * ID of the canonical game item emitted by this outcome.
		 */
		itemUid: IdSchema.describe("The ID of the canonical game item emitted by this outcome."),
		/**
		 * Number of this item emitted by the outcome.
		 */
		quantity: QuantitySchema.describe("The quantity emitted by this outcome."),
		/**
		 * Board-placement strategy used after this outcome is resolved.
		 *
		 * The default local drop searches from the source by Manhattan distance.
		 * Regardless of the selected strategy, runtime first checks board capacity.
		 */
		placement: PlacementSchema.default(PlacementSchema.enum.Drop).describe(
			"The board-placement strategy for this outcome; defaults to a local Manhattan-distance drop.",
		),
		/**
		 * Rules evaluated after this outcome is selected by a successful roll.
		 *
		 * Every `enable` rule must pass and any applicable `disable` rule prevents
		 * this outcome from being emitted. Rejection does not reroll or replace it.
		 */
		rules: z
			.array(OutcomeRuleSchema)
			.describe("Rules evaluated after this outcome is selected by a successful roll."),
	})
	.strict()
	.meta({
		id: "ItemOutcomeSchema",
		description:
			"A canonical game item, quantity, board-placement strategy, and rules for a successful roll's outcome.",
	});

export type ItemOutcomeSchema = typeof ItemOutcomeSchema;

export namespace ItemOutcomeSchema {
	export type Type = z.infer<ItemOutcomeSchema>;
}
