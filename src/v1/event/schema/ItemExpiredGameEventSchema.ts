import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

export const ItemExpiredGameEventSchema = z
	.object({
		type: z.literal("item:expired"),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
	})
	.strict()
	.meta({
		id: "ItemExpiredGameEventSchema",
		description: "Transient fact that one temporary item expiry committed.",
	});

export type ItemExpiredGameEventSchema = typeof ItemExpiredGameEventSchema;

export namespace ItemExpiredGameEventSchema {
	export type Type = z.infer<ItemExpiredGameEventSchema>;
}
