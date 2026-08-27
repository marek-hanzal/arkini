import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { GameEventEnumSchema } from "./GameEventEnumSchema";

/** One exact charged item committed its final charge spend. */
export const ItemDepletedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemDepleted",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
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
