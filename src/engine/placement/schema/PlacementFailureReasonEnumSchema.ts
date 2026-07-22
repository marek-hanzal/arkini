import { z } from "zod";

/**
 * Discriminates why one resolved drop cannot be placed completely.
 */
export const PlacementFailureReasonEnumSchema = z
	.enum({
		ItemMaxCount: "item:max-count",
		BoardFull: "board:full",
		InventoryFull: "inventory:full",
		ToolbarFull: "toolbar:full",
	})
	.meta({
		id: "PlacementFailureReasonEnumSchema",
		description: "Why one resolved drop cannot be placed completely.",
	});

export type PlacementFailureReasonEnumSchema = typeof PlacementFailureReasonEnumSchema;

export namespace PlacementFailureReasonEnumSchema {
	export type Type = z.infer<PlacementFailureReasonEnumSchema>;
}
