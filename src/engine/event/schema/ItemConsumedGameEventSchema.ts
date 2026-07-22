import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";
import { JobLocationSchema } from "~/engine/location/schema/JobLocationSchema";

export const ItemConsumedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			GameEventEnumSchema.enum.ItemConsumed,
		]),
		itemId: IdSchema,
		consumedItemId: IdSchema,
		canonicalItemId: IdSchema,
		previousLocation: InputLocationSchema,
		location: JobLocationSchema,
		previousQuantity: z.number().int().positive(),
		consumedQuantity: z.number().int().positive(),
		quantity: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "ItemConsumedGameEventSchema",
		description:
			"Transient fact that an accepted input allocation moved exact material identity from an owner input into one committed job.",
	});

export type ItemConsumedGameEventSchema = typeof ItemConsumedGameEventSchema;

export namespace ItemConsumedGameEventSchema {
	export type Type = z.infer<ItemConsumedGameEventSchema>;
}
