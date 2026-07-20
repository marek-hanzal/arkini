import { z } from "zod";

/** Finite player-facing tabs that one live item may expose in Item Detail. */
export const ItemDetailTabEnumSchema = z
	.enum([
		"info",
		"status",
		"lines",
		"queue",
	])
	.meta({
		id: "ItemDetailTabEnumSchema",
		description: "The finite player-facing tabs available in Item Detail for one live item.",
	});

export type ItemDetailTabEnumSchema = typeof ItemDetailTabEnumSchema;

export namespace ItemDetailTabEnumSchema {
	export type Type = z.infer<ItemDetailTabEnumSchema>;
}
