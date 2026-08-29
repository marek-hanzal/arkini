import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";
import { GameEventEnumSchema } from "./GameEventEnumSchema";

/** One accepted input allocation changed one exact visible source identity. */
export const ItemConsumedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemConsumed",
		]),
		sourceItemId: IdSchema,
		canonicalItemId: IdSchema,
		sourceLocation: InputLocationSchema,
		previousQuantity: z.number().int().positive(),
		consumedQuantity: z.number().int().positive(),
		resultingQuantity: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "ItemConsumedGameEventSchema",
		description:
			"Transient fact that one accepted input allocation changed one exact visible source identity.",
	});

export type ItemConsumedGameEventSchema = typeof ItemConsumedGameEventSchema;

export namespace ItemConsumedGameEventSchema {
	export type Type = z.infer<ItemConsumedGameEventSchema>;
}
