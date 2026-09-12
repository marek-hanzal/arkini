import { z } from "zod";

import { BlueprintSchema } from "./BlueprintSchema";
import { ClockSchema } from "./ClockSchema";
import { InventorySchema } from "./InventorySchema";
import { CommonSchema } from "./CommonSchema";
import { TemporarySchema } from "./TemporarySchema";

/**
 * An item configuration, resolved by its `type` discriminator.
 *
 * Each item kind owns its specialized shape while sharing the common base item
 * fields through its dedicated schema.
 */
export const ItemSchema = z
	.discriminatedUnion("type", [
		BlueprintSchema,
		CommonSchema,
		ClockSchema,
		TemporarySchema,
		InventorySchema,
	])
	.superRefine((item, context) => {
		if (item.type === "common" && item.action !== undefined && item.lines.length > 0) {
			context.addIssue({
				code: "custom",
				path: [
					"action",
				],
				message: "An item cannot have both an action and production lines.",
			});
		}
	})
	.meta({
		id: "ItemSchema",
		description: "A game item selected by its type discriminator.",
	});

export type ItemSchema = typeof ItemSchema;

export namespace ItemSchema {
	export type Type = z.infer<ItemSchema>;
}
