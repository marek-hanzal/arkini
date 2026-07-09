import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemTypeEnumSchema } from "./ItemTypeEnumSchema";

/**
 * An item that will trigger the inventory cheat.
 */
export const CheatInventoryItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemTypeEnumSchema.extract([
			"cheat:inventory",
		]),
	})
	.strict()
	.describe("An item that triggers the inventory cheat.");

export type CheatInventoryItemSchema = typeof CheatInventoryItemSchema;

export namespace CheatInventoryItemSchema {
	export type Type = z.infer<CheatInventoryItemSchema>;
}
