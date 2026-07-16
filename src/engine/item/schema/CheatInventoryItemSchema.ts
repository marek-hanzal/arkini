import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An authoring marker for the cheat-inventory sink capability.
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
		description: "An authored board utility that consumes eligible items dropped onto it.",
	});

export type CheatInventoryItemSchema = typeof CheatInventoryItemSchema;

export namespace CheatInventoryItemSchema {
	export type Type = z.infer<CheatInventoryItemSchema>;
}
