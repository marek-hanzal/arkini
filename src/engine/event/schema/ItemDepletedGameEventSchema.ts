import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { GameEventEnumSchema } from "./GameEventEnumSchema";

/** One exact charged item committed its final charge spend. */
export const ItemDepletedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			GameEventEnumSchema.enum.ItemDepleted,
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: BoardLocationSchema,
		previousQuantity: z.number().int().positive(),
		resultingQuantity: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "ItemDepletedGameEventSchema",
		description:
			"Transient fact that one exact charged item committed its final charge spend, including whether its identity survived as a smaller stack.",
	});

export type ItemDepletedGameEventSchema = typeof ItemDepletedGameEventSchema;

export namespace ItemDepletedGameEventSchema {
	export type Type = z.infer<ItemDepletedGameEventSchema>;
}
