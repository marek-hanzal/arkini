import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { LocationSchema } from "~/engine/location/schema/LocationSchema";
import { GameEventEnumSchema } from "./GameEventEnumSchema";

/** One exact live item was removed through the explicit neutral remove command. */
export const ItemExplicitlyRemovedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemExplicitlyRemoved",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: LocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict()
	.meta({
		id: "ItemExplicitlyRemovedGameEventSchema",
		description:
			"Transient fact owned only by the explicit neutral remove command, retaining the exact removed identity.",
	});

export type ItemExplicitlyRemovedGameEventSchema = typeof ItemExplicitlyRemovedGameEventSchema;

export namespace ItemExplicitlyRemovedGameEventSchema {
	export type Type = z.infer<ItemExplicitlyRemovedGameEventSchema>;
}
