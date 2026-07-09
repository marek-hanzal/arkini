import { z } from "zod";

/**
 * Discriminates the specialized configuration schema used by an item.
 */
export const ItemTypeEnumSchema = z
	.enum([
		"simple",
		"producer",
		"craft",
		"stash",
		"cheat:speed:on",
		"cheat:speed:off",
		"nuke",
		"cheat:inventory",
	])
	.describe("The kind of gameplay item described by an item configuration.");

export type ItemTypeEnumSchema = typeof ItemTypeEnumSchema;

export namespace ItemTypeEnumSchema {
	export type Type = z.infer<ItemTypeEnumSchema>;
}
