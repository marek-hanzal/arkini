import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

export const ItemReplacedGameEventSchema = z
	.object({
		type: z.literal("item:replaced"),
		outgoingItemId: IdSchema,
		outgoingCanonicalItemId: IdSchema,
		incomingItemId: IdSchema,
		incomingCanonicalItemId: IdSchema,
		location: GridLocationSchema,
	})
	.strict()
	.meta({ id: "ItemReplacedGameEventSchema", description: "Transient fact that an outgoing exact identity was replaced at the same canonical anchor." });

export type ItemReplacedGameEventSchema = typeof ItemReplacedGameEventSchema;
export namespace ItemReplacedGameEventSchema {
	export type Type = z.infer<ItemReplacedGameEventSchema>;
}
