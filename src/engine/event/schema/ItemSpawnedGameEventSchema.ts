import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

export const ItemSpawnedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract(["ItemSpawned"]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict()
	.meta({
		id: "ItemSpawnedGameEventSchema",
		description: "Transient fact that one exact runtime item identity was committed.",
	});

export type ItemSpawnedGameEventSchema = typeof ItemSpawnedGameEventSchema;
export namespace ItemSpawnedGameEventSchema {
	export type Type = z.infer<ItemSpawnedGameEventSchema>;
}
