import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/** A singleton Board/Toolbar item that opens the shared inventory surface. */
export const InventoryItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"Inventory",
		]).describe("Identifies this item as the shared inventory opener."),
		scope: StorageScopeEnumSchema.extract([
			"Board",
		])
			.default(StorageScopeEnumSchema.enum.Board)
			.describe(
				"Uses Board for automatic placement; the inventory item type also permits an exact Toolbar location.",
			),
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
		description: "A singleton Board/Toolbar item that opens the shared inventory surface.",
	});

export type InventoryItemSchema = typeof InventoryItemSchema;

export namespace InventoryItemSchema {
	export type Type = z.infer<InventoryItemSchema>;
}
