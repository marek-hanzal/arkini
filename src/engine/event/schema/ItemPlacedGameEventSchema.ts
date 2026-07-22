import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";
import { ReservedLocationSchema } from "~/engine/location/schema/ReservedLocationSchema";
import { GameEventEnumSchema } from "./GameEventEnumSchema";

/** One existing exact runtime identity became visible at a canonical grid anchor. */
export const ItemPlacedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract(["ItemPlaced"]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		previousLocation: z.union([InputLocationSchema, ReservedLocationSchema]),
		location: GridLocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict()
	.meta({
		id: "ItemPlacedGameEventSchema",
		description:
			"Transient fact that one existing exact runtime identity became visible at a canonical grid anchor.",
	});

export type ItemPlacedGameEventSchema = typeof ItemPlacedGameEventSchema;

export namespace ItemPlacedGameEventSchema {
	export type Type = z.infer<ItemPlacedGameEventSchema>;
}
