import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

export const ItemRemovedGameEventSchema = z
	.object({
		type: z.literal("item:removed"),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		quantity: z.number().int().positive(),
		reason: z.enum(["consumed", "depleted", "expired", "lifecycle"]),
	})
	.strict()
	.meta({ id: "ItemRemovedGameEventSchema", description: "Transient fact that one exact runtime item left committed runtime." });

export type ItemRemovedGameEventSchema = typeof ItemRemovedGameEventSchema;
export namespace ItemRemovedGameEventSchema {
	export type Type = z.infer<ItemRemovedGameEventSchema>;
}
