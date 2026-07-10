import { z } from "zod";

import { BaseRuntimeItemSchema } from "./BaseRuntimeItemSchema";

/** A hydrated live item or stack occupying one inventory slot. */
export const RuntimeInventoryItemSchema = z
	.object({
		...BaseRuntimeItemSchema.shape,
	})
	.strict()
	.meta({
		id: "RuntimeInventoryItemSchema",
		description: "A hydrated live item or stack occupying one inventory slot.",
	});

export type RuntimeInventoryItemSchema = typeof RuntimeInventoryItemSchema;

export namespace RuntimeInventoryItemSchema {
	export type Type = z.infer<RuntimeInventoryItemSchema>;
}
