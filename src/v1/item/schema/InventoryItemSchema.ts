import { z } from "zod";

import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A singleton board item that opens the shared inventory.
 */
export const InventoryItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"inventory",
		]).describe("Identifies this item as the shared inventory opener."),
		scope: ScopeEnumSchema.extract([
			"board",
		])
			.default("board")
			.describe("Keeps the inventory opener on the board."),
		maxCount: PositiveIntegerSchema.max(1)
			.default(1)
			.describe("Allows exactly one inventory opener in game state."),
		maxStackSize: PositiveIntegerSchema.max(1)
			.default(1)
			.describe("Prevents the inventory opener from stacking."),
	})
	.strict()
	.meta({
		id: "InventoryItemSchema",
		description: "A singleton board item that opens the shared inventory.",
	});

export type InventoryItemSchema = typeof InventoryItemSchema;

export namespace InventoryItemSchema {
	export type Type = z.infer<InventoryItemSchema>;
}
