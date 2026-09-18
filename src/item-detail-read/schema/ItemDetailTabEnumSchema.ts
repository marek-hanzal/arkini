import { z } from "zod";

/** Fixed player-facing sections exposed by every Item Detail target. */
export const ItemDetailTabEnumSchema = z
	.enum({
		Info: "info",
		Lines: "lines",
		Queue: "queue",
	})
	.meta({
		id: "ItemDetailTabEnumSchema",
		description: "The fixed player-facing sections available in every Item Detail.",
	});

export type ItemDetailTabEnumSchema = typeof ItemDetailTabEnumSchema;

export namespace ItemDetailTabEnumSchema {
	export type Type = z.infer<ItemDetailTabEnumSchema>;
}
