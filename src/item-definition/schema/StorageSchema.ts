import { z } from "zod";

/**
 * Where one canonical item may physically exist in grid state.
 */
export const StorageSchema = z
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

export type StorageSchema = typeof StorageSchema;

export namespace StorageSchema {
	export type Type = z.infer<StorageSchema>;
}
