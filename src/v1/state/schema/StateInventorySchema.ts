import { z } from "zod";

import { StateInventoryItemSchema } from "./StateInventoryItemSchema";

/**
 * Persisted contents of the ordered runtime inventory.
 */
export const StateInventorySchema = z
	.object({
		/**
		 * Ordered inventory slots; `null` represents an empty slot.
		 */
		slots: z
			.array(StateInventoryItemSchema.nullable())
			.describe("The ordered persisted inventory slots, including empty slots."),
	})
	.strict()
	.meta({
		id: "StateInventorySchema",
		description: "The persisted contents of the ordered runtime inventory.",
	});

export type StateInventorySchema = typeof StateInventorySchema;

export namespace StateInventorySchema {
	export type Type = z.infer<StateInventorySchema>;
}
