import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An authoring marker for the inventory-cheat capability.
 */
export const CheatInventoryItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"cheat:inventory",
		]),
	})
	.strict()
	.meta({
		id: "CheatInventoryItemSchema",
		description: "An authored item marker for a future inventory-cheat capability.",
	});

export type CheatInventoryItemSchema = typeof CheatInventoryItemSchema;

export namespace CheatInventoryItemSchema {
	export type Type = z.infer<CheatInventoryItemSchema>;
}
