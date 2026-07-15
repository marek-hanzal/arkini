import { z } from "zod";

/**
 * Where one canonical item may physically exist in grid state.
 */
export const StorageScopeEnumSchema = z
	.enum([
		/**
		 * The item may exist only on a board.
		 */
		"board",
		/**
		 * The item may exist only in the shared inventory.
		 */
		"inventory",
		/**
		 * The item may exist on a board or in the shared inventory.
		 */
		"any",
	])
	.meta({
		id: "StorageScopeEnumSchema",
		description: "Where one canonical item may physically exist in grid state.",
	});

export type StorageScopeEnumSchema = typeof StorageScopeEnumSchema;

export namespace StorageScopeEnumSchema {
	export type Type = z.infer<StorageScopeEnumSchema>;
}
