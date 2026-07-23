import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { GameEventEnumSchema } from "./GameEventEnumSchema";

/** One autonomous input store changed one exact visible source identity. */
export const ItemInputStoredGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemInputStored",
		]),
		sourceItemId: IdSchema,
		canonicalItemId: IdSchema,
		previousSourceLocation: GridLocationSchema,
		previousQuantity: z.number().int().positive(),
		storedQuantity: z.number().int().positive(),
		resultingQuantity: z.number().int().nonnegative(),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "ItemInputStoredGameEventSchema",
		description:
			"Transient fact that one autonomous input store changed one exact visible source identity.",
	});

export type ItemInputStoredGameEventSchema = typeof ItemInputStoredGameEventSchema;

export namespace ItemInputStoredGameEventSchema {
	export type Type = z.infer<ItemInputStoredGameEventSchema>;
}
