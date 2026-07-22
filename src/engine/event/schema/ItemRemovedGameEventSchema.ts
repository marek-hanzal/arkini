import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";
import { ItemRemovedReasonEnumSchema } from "./ItemRemovedReasonEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

export const ItemRemovedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			GameEventEnumSchema.enum.ItemRemoved,
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		quantity: z.number().int().positive(),
		reason: ItemRemovedReasonEnumSchema,
	})
	.strict()
	.meta({ id: "ItemRemovedGameEventSchema", description: "Transient fact that one exact runtime item left committed runtime." });

export type ItemRemovedGameEventSchema = typeof ItemRemovedGameEventSchema;
export namespace ItemRemovedGameEventSchema {
	export type Type = z.infer<ItemRemovedGameEventSchema>;
}
