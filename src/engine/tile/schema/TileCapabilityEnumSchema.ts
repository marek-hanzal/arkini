import { z } from "zod";

/** Finite player-facing workspaces that one live tile may expose. */
export const TileCapabilityEnumSchema = z
	.enum([
		"info",
		"status",
		"lines",
		"effects",
	])
	.meta({
		id: "TileCapabilityEnumSchema",
		description: "The finite player-facing workspace capabilities available to a live tile.",
	});

export type TileCapabilityEnumSchema = typeof TileCapabilityEnumSchema;

export namespace TileCapabilityEnumSchema {
	export type Type = z.infer<TileCapabilityEnumSchema>;
}
