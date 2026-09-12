import { z } from "zod";

/**
 * Discriminates the specialized configuration schema used by an item.
 */
export const TypeSchema = z
	.enum({
		Common: "common",
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
