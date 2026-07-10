import { z } from "zod";

import { BaseStateItemSchema } from "./BaseStateItemSchema";

/** A persisted live item or stack occupying one inventory slot. */
export const StateInventoryItemSchema = z
	.object({
		...BaseStateItemSchema.shape,
	})
	.strict()
	.meta({
		id: "StateInventoryItemSchema",
		description: "A persisted live item or stack occupying one inventory slot.",
	});

export type StateInventoryItemSchema = typeof StateInventoryItemSchema;

export namespace StateInventoryItemSchema {
	export type Type = z.infer<StateInventoryItemSchema>;
}
