import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import { PositionSchema } from "~/item-location/schema/PositionSchema";

/** Defines a positive quantity of one canonical item in the initial inventory. */
export const InventoryItemSchema = z
	.object({
		/**
		 * Canonical item added to the inventory.
		 */
		itemId: IdSchema.describe("The canonical item ID added to the initial inventory."),
		position: PositionSchema.describe(
			"The exact initial inventory slot occupied by this stack.",
		),
		/**
		 * Number of item instances added to the inventory.
		 */
		quantity: PositiveIntegerSchema.default(1).describe(
			"The positive initial inventory quantity; defaults to one.",
		),
	})
	.strict()
	.meta({
		id: "start.InventoryItemSchema",
		description: "A positive quantity of one canonical item in the initial inventory.",
	});

export type InventoryItemSchema = typeof InventoryItemSchema;

export namespace InventoryItemSchema {
	export type Type = z.infer<InventoryItemSchema>;
}
