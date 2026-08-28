import { z } from "zod";

/**
 * Where one canonical item may physically exist in grid state.
 */
export const StorageScopeEnumSchema = z
	.enum({
		Board: "board",
		Inventory: "inventory",
		Toolbar: "toolbar",
		Any: "any",
	})
	.meta({
		id: "scope.StorageSchema",
		description: "Where one canonical item may physically exist in grid state.",
	});

export type StorageScopeEnumSchema = typeof StorageScopeEnumSchema;

export namespace StorageScopeEnumSchema {
	export type Type = z.infer<StorageScopeEnumSchema>;
}
