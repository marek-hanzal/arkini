import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

export const ItemDepletedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			GameEventEnumSchema.enum.ItemDepleted,
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		previousQuantity: z.number().int().positive(),
		quantity: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "ItemDepletedGameEventSchema",
		description:
			"Transient fact that one exact charged item committed its final charge spend, including whether its actor remained as a smaller stack.",
	});

export type ItemDepletedGameEventSchema = typeof ItemDepletedGameEventSchema;

export namespace ItemDepletedGameEventSchema {
	export type Type = z.infer<ItemDepletedGameEventSchema>;
}
