import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

export const ItemStackedGameEventSchema = z
	.object({
		type: z.literal("item:stacked"),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		previousQuantity: z.number().int().positive(),
		quantity: z.number().int().positive(),
	})
	.strict()
	.meta({ id: "ItemStackedGameEventSchema", description: "Transient fact that an existing exact stack grew." });

export type ItemStackedGameEventSchema = typeof ItemStackedGameEventSchema;
export namespace ItemStackedGameEventSchema {
	export type Type = z.infer<ItemStackedGameEventSchema>;
}
