import { z } from "zod";

/**
 * Discriminates the specialized configuration schema used by an item.
 */
export const ItemEnumSchema = z
	.enum([
		/**
		 * A finite-resource authoring definition with configured capacity.
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
		 * An item definition that owns one stash product line.
		 */
		"stash",
		/**
		 * A board-only item definition with a configured duration.
		 */
		"temporary",
		/**
		 * An authoring marker for the shared inventory opener.
		 */
		"inventory",
		/**
		 * An authoring marker for board-layout memory.
		 */
		"memory",
		/**
		 * An authoring marker for the speed-cheat capability.
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
