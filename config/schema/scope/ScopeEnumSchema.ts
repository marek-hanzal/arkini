import { z } from "zod";

/**
 * Discriminates the game-state scope searched by a configuration feature.
 */
export const ScopeEnumSchema = z
	.enum([
		/**
		 * Searches only placed board items.
		 */
		"board",
		/**
		 * Searches only items held in the inventory.
		 */
		"inventory",
		/**
		 * Searches the board and inventory together, combining their item counts.
		 */
		"any",
	])
	.describe("The game-state scope searched by a configuration feature.");

export type ScopeEnumSchema = typeof ScopeEnumSchema;

export namespace ScopeEnumSchema {
	export type Type = z.infer<ScopeEnumSchema>;
}
