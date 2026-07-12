import { z } from "zod";

/**
 * Discriminates the specialized configuration schema used by an item.
 */
export const ItemEnumSchema = z
	.enum([
		/**
		 * A finite resource item that disappears after its capacity is used.
		 */
		"deposit",
		/**
		 * A construction blueprint with an explicit target item.
		 */
		"blueprint",
		/**
		 * An item with no specialized gameplay behavior.
		 */
		"simple",
		/**
		 * An item that owns one or more product lines.
		 */
		"producer",
		/**
		 * An item that owns one craft product line.
		 */
		"craft",
		/**
		 * A single-use item that owns one stash product line.
		 */
		"stash",
		/**
		 * A board-only item that expires after a configured duration.
		 */
		"temporary",
		/**
		 * A board item that opens the shared inventory.
		 */
		"inventory",
		/**
		 * An item that stores and restores a board layout.
		 */
		"memory",
		/**
		 * A stateful item that toggles the speed cheat.
		 */
		"cheat:speed",
		"nuke",
		"cheat:inventory",
	])
	.meta({
		id: "ItemEnumSchema",
		description: "The kind of gameplay item described by an item configuration.",
	});

export type ItemEnumSchema = typeof ItemEnumSchema;

export namespace ItemEnumSchema {
	export type Type = z.infer<ItemEnumSchema>;
}
