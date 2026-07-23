import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { GameEventEnumSchema } from "./GameEventEnumSchema";

/** One exact charged item committed a non-terminal charge spend. */
export const ItemChargeSpentGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemChargeSpent",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: BoardLocationSchema,
		previousCharges: z.number().int().positive(),
		resultingCharges: z.number().int().positive(),
	})
	.strict()
	.refine((event) => event.resultingCharges < event.previousCharges, {
		message: "resultingCharges must be less than previousCharges",
	})
	.meta({
		id: "ItemChargeSpentGameEventSchema",
		description:
			"Transient fact that one exact surviving charged item committed a non-terminal charge spend.",
	});

export type ItemChargeSpentGameEventSchema = typeof ItemChargeSpentGameEventSchema;

export namespace ItemChargeSpentGameEventSchema {
	export type Type = z.infer<ItemChargeSpentGameEventSchema>;
}
