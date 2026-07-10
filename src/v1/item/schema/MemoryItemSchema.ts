import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

import { AssetSchema } from "./AssetSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item that stores, restores, and clears one board layout snapshot.
 */
export const MemoryItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"memory",
		]).describe("Identifies this item as a board layout memory."),
		asset: z
			.object({
				...AssetSchema.shape,
				source: z
					.tuple([
						IdSchema,
						IdSchema,
					])
					.describe("Exactly two ordered asset IDs: empty memory, then full memory."),
			})
			.strict(),
		scope: ScopeEnumSchema.extract([
			"any",
		])
			.default("any")
			.describe("Allows board layout memories on the board or in inventory."),
		maxStackSize: PositiveIntegerSchema.max(1)
			.default(1)
			.describe("Keeps every board layout memory as an individual instance."),
	})
	.strict()
	.meta({
		id: "MemoryItemSchema",
		description: "An individual item that stores and restores one board layout snapshot.",
	});

export type MemoryItemSchema = typeof MemoryItemSchema;

export namespace MemoryItemSchema {
	export type Type = z.infer<MemoryItemSchema>;
}
