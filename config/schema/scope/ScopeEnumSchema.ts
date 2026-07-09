import { z } from "zod";

/**
 * Discriminates the part of game state targeted by a configuration feature.
 */
export const ScopeEnumSchema = z
	.enum([
		/**
		 * Targets only placed board items.
		 */
		"board",
		/**
		 * Targets only items held in the inventory.
		 */
		"inventory",
		/**
		 * Targets both the board and inventory.
		 */
		"any",
	])
	.describe("The part of game state targeted by a configuration feature.");

export type ScopeEnumSchema = typeof ScopeEnumSchema;

export namespace ScopeEnumSchema {
	export type Type = z.infer<ScopeEnumSchema>;
}
