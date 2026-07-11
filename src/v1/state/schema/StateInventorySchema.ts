import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { StateItemSchema } from "./StateItemSchema";

/**
 * Persisted inventory items keyed by their grid cell.
 */
export const StateInventorySchema = z
	.object({
		/**
		 * Persisted inventory items keyed by their grid cell.
		 */
		cells: z
			.record(IdSchema, StateItemSchema)
			.describe("Persisted inventory items keyed by their grid cell."),
	})
	.strict()
	.meta({
		id: "StateInventorySchema",
		description: "The persisted inventory grid.",
	});

export type StateInventorySchema = typeof StateInventorySchema;

export namespace StateInventorySchema {
	export type Type = z.infer<StateInventorySchema>;
}
