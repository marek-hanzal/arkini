import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/**
 * Hydrated live inventory items keyed by their grid cell.
 */
export const RuntimeInventorySchema = z
	.object({
		/**
		 * Hydrated inventory items keyed by their grid cell.
		 */
		cells: z
			.record(IdSchema, RuntimeItemSchema)
			.describe("Hydrated inventory items keyed by their grid cell."),
	})
	.strict()
	.meta({
		id: "RuntimeInventorySchema",
		description: "The hydrated live inventory grid.",
	});

export type RuntimeInventorySchema = typeof RuntimeInventorySchema;

export namespace RuntimeInventorySchema {
	export type Type = z.infer<RuntimeInventorySchema>;
}
