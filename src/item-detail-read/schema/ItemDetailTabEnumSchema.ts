import { z } from "zod";

/** Finite player-facing tabs that one runtime or configured definition may expose. */
export const ItemDetailTabEnumSchema = z
	.enum({
		Info: "info",
		Lines: "lines",
		Queue: "queue",
		Sources: "sources",
	})
	.meta({
		id: "ItemDetailTabEnumSchema",
		description:
			"The finite player-facing tabs available in Item Detail for one runtime or configured definition.",
	});

export type ItemDetailTabEnumSchema = typeof ItemDetailTabEnumSchema;

export namespace ItemDetailTabEnumSchema {
	export type Type = z.infer<ItemDetailTabEnumSchema>;
}
