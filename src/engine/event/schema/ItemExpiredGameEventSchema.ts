import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";

export const ItemExpiredGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemExpired",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: BoardLocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict()
	.meta({
		id: "ItemExpiredGameEventSchema",
		description: "Transient fact that one exact temporary item expiry committed.",
	});

export type ItemExpiredGameEventSchema = typeof ItemExpiredGameEventSchema;

export namespace ItemExpiredGameEventSchema {
	export type Type = z.infer<ItemExpiredGameEventSchema>;
}
