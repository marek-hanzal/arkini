import { z } from "zod";

/**
 * Discriminates the specialized configuration schema used by an item.
 */
export const ItemEnumSchema = z
	.enum({
		Deposit: "deposit",
		Blueprint: "blueprint",
		Simple: "simple",
		Producer: "producer",
		Craft: "craft",
		Stash: "stash",
		Temporary: "temporary",
		Inventory: "inventory",
	})
	.meta({
		id: "ItemEnumSchema",
		description: "The kind of gameplay item described by an item configuration.",
	});

export type ItemEnumSchema = typeof ItemEnumSchema;

export namespace ItemEnumSchema {
	export type Type = z.infer<ItemEnumSchema>;
}
