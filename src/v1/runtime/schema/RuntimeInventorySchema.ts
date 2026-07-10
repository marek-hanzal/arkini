import { z } from "zod";

import { RuntimeInventoryItemSchema } from "./RuntimeInventoryItemSchema";

/** Hydrated contents of the ordered live runtime inventory. */
export const RuntimeInventorySchema = z
	.object({
		/** Ordered inventory slots; `null` represents an empty slot. */
		slots: z
			.array(RuntimeInventoryItemSchema.nullable())
			.describe("The ordered hydrated inventory slots, including empty slots."),
	})
	.strict()
	.meta({
		id: "RuntimeInventorySchema",
		description: "The hydrated contents of the ordered live runtime inventory.",
	});

export type RuntimeInventorySchema = typeof RuntimeInventorySchema;

export namespace RuntimeInventorySchema {
	export type Type = z.infer<RuntimeInventorySchema>;
}
