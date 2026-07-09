import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item that will trigger the inventory cheat.
 */
export const CheatInventoryItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"cheat:inventory",
		]),
	})
	.strict()
	.describe("An item that triggers the inventory cheat.");

export type CheatInventoryItemSchema = typeof CheatInventoryItemSchema;

export namespace CheatInventoryItemSchema {
	export type Type = z.infer<CheatInventoryItemSchema>;
}
