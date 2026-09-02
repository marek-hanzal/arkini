import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/** A singleton Board/Toolbar item that opens the shared inventory surface. */
export const InventorySchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
			"Inventory",
		]).describe("Identifies this item as the shared inventory opener."),
		scope: StorageSchema.extract([
			"Board",
		])
			.default(StorageSchema.enum.Board)
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
		id: "item.InventorySchema",
		description: "A singleton Board/Toolbar item that opens the shared inventory surface.",
	});

export type InventorySchema = typeof InventorySchema;

export namespace InventorySchema {
	export type Type = z.infer<InventorySchema>;
}
