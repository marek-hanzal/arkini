import { z } from "zod";

import { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { RuleSchema } from "./drop/rule/RuleSchema";
import { PlacementEnumSchema } from "./PlacementEnumSchema";

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
		 */
		placement: PlacementEnumSchema.default("drop").describe(
			"The board-placement strategy for this drop; defaults to a local Manhattan-distance drop.",
		),
		/**
		 * Rules evaluated after this drop is selected by a successful roll.
		 *
		 * A failed `require` or an applicable `block` prevents this drop from
		 * being emitted; it does not reroll or replace the selected drop.
		 */
		rules: z
			.array(RuleSchema)
			.describe("Rules evaluated after this drop is selected by a successful roll."),
	})
	.strict()
	.meta({
		id: "DropSchema",
		description:
			"A canonical game item, quantity, placement strategy, and rules for a successful roll's drop.",
	});

export type DropSchema = typeof DropSchema;

export namespace DropSchema {
	export type Type = z.infer<DropSchema>;
}
