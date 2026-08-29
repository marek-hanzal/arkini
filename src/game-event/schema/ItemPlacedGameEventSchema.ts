import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { InputLocationSchema } from "~/item-location/schema/InputLocationSchema";
import { InventoryLocationSchema } from "~/item-location/schema/InventoryLocationSchema";
import { ReservedLocationSchema } from "~/item-location/schema/ReservedLocationSchema";
import { GameEventEnumSchema } from "./GameEventEnumSchema";

/** One existing exact runtime identity became visible at a canonical grid anchor. */
export const ItemPlacedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemPlaced",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		originItemId: IdSchema,
		previousLocation: z.union([
			InputLocationSchema,
			ReservedLocationSchema,
			InventoryLocationSchema,
		]),
		location: GridLocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict()
	.meta({
		id: "ItemPlacedGameEventSchema",
		description:
			"Transient fact that one existing exact runtime identity became visible from a buffered, reserved, or Inventory origin at a canonical grid anchor.",
	});

export type ItemPlacedGameEventSchema = typeof ItemPlacedGameEventSchema;

export namespace ItemPlacedGameEventSchema {
	export type Type = z.infer<ItemPlacedGameEventSchema>;
}
