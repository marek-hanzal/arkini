import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { PlacementEnumSchema } from "./PlacementEnumSchema";

/**
 * A fully resolved item drop ready for placement.
 *
 * Its availability rules have already passed and its configured quantity has
 * already been resolved to one concrete positive integer.
 */
export const DropResultSchema = z
	.object({
		/**
		 * ID of the canonical game item emitted by this resolved drop.
		 */
		itemId: IdSchema.describe(
			"The ID of the canonical game item emitted by this resolved drop.",
		),
		/**
		 * Concrete positive quantity emitted by this resolved drop.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The concrete positive quantity emitted by this resolved drop.",
		),
		/**
		 * Board-placement strategy used after this drop is resolved.
		 */
		placement: PlacementEnumSchema.describe(
			"The board-placement strategy used for this resolved drop.",
		),
	})
	.strict()
	.meta({
		id: "DropResultSchema",
		description: "A fully resolved item drop ready for placement.",
	});

export type DropResultSchema = typeof DropResultSchema;

export namespace DropResultSchema {
	export type Type = z.infer<DropResultSchema>;
}
