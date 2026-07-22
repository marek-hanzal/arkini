import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

export const ItemExpiredGameEventSchema = z
	.object({
		type: z.literal("item:expired"),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
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
