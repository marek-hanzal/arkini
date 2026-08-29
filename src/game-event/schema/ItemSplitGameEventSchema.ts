import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";

export const ItemSplitGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemSplit",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		previousQuantity: z.number().int().min(2),
		quantity: PositiveIntegerSchema,
	})
	.strict()
	.superRefine((event, context) => {
		if (event.quantity >= event.previousQuantity) {
			context.addIssue({
				code: "custom",
				message: "Split identity must retain less than its previous quantity.",
				path: [
					"quantity",
				],
			});
		}
	})
	.meta({
		id: "ItemSplitGameEventSchema",
		description:
			"Transient fact that one exact stack identity retained a smaller quantity while its pure remainder was placed separately.",
	});

export type ItemSplitGameEventSchema = typeof ItemSplitGameEventSchema;

export namespace ItemSplitGameEventSchema {
	export type Type = z.infer<ItemSplitGameEventSchema>;
}
