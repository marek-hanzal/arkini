import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

export const ItemSplitGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemSplit",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		previousQuantity: z.number().int().min(2),
		quantity: z.literal(1),
	})
	.strict()
	.meta({
		id: "ItemSplitGameEventSchema",
		description:
			"Transient fact that one exact stack identity retained one stateful item while its pure remainder was placed separately.",
	});

export type ItemSplitGameEventSchema = typeof ItemSplitGameEventSchema;

export namespace ItemSplitGameEventSchema {
	export type Type = z.infer<ItemSplitGameEventSchema>;
}
