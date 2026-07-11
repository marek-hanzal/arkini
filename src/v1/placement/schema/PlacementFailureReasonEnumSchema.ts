import { z } from "zod";

/**
 * Discriminates why one resolved drop cannot be placed completely.
 */
export const PlacementFailureReasonEnumSchema = z
	.enum([
		"item:max-count",
		"board:full",
		"inventory:full",
		"replace:origin-not-board",
		"replace:board-forbidden",
	])
	.meta({
		id: "PlacementFailureReasonEnumSchema",
		description: "Why one resolved drop cannot be placed completely.",
	});

export type PlacementFailureReasonEnumSchema = typeof PlacementFailureReasonEnumSchema;

export namespace PlacementFailureReasonEnumSchema {
	export type Type = z.infer<PlacementFailureReasonEnumSchema>;
}
