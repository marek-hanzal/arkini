import { z } from "zod";

/**
 * Discriminates the specialized configuration schema used by an item.
 */
export const TypeSchema = z
	.enum({
		Deposit: "deposit",
		Blueprint: "blueprint",
		Simple: "simple",
		Space: "space",
		Producer: "producer",
		Craft: "craft",
		Stash: "stash",
		Temporary: "temporary",
		Inventory: "inventory",
	})
	.meta({
		id: "item.TypeSchema",
		description: "The kind of gameplay item described by an item configuration.",
	});

export type TypeSchema = typeof TypeSchema;

export namespace TypeSchema {
	export type Type = z.infer<TypeSchema>;
}
