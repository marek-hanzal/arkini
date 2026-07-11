import { z } from "zod";

import { StateBoardSchema } from "./StateBoardSchema";
import { StateInventorySchema } from "./StateInventorySchema";

/**
 * Serializable gameplay state stored without canonical configuration objects.
 *
 * Loading hydrates every `itemId` into the canonical item reference owned by
 * the active game configuration.
 */
export const StateSchema = z
	.object({
		/**
		 * Persisted board items keyed by their grid cell.
		 */
		board: StateBoardSchema.describe("The persisted board grid."),
		/**
		 * Persisted inventory items keyed by their grid cell.
		 */
		inventory: StateInventorySchema.describe("The persisted inventory grid."),
	})
	.strict()
	.meta({
		id: "StateSchema",
		description: "Serializable gameplay state hydrated into the active runtime.",
	});

export type StateSchema = typeof StateSchema;

export namespace StateSchema {
	export type Type = z.infer<StateSchema>;
}
