import { z } from "zod";

import { InventorySchema } from "./InventorySchema";
import { CommonSchema } from "./CommonSchema";

/**
 * An item configuration, resolved by its `type` discriminator.
 *
 * Each item kind owns its specialized shape while sharing the common base item
 * fields through its dedicated schema.
 */
export const ItemSchema = z
	.discriminatedUnion("type", [
		CommonSchema,
		InventorySchema,
	])
	.superRefine((item, context) => {
		if (item.type === "common" && item.clock !== undefined) {
			for (const [field, valid, message] of [
				[
					"scope",
					item.scope === "board",
					"Clock requires Board storage.",
				],
				[
					"maxStackSize",
					item.maxStackSize === 1,
					"Clock items cannot stack.",
				],
				[
					"action",
					item.action === undefined,
					"An item cannot have both Clock and Action.",
				],
			] as const) {
				if (!valid)
					context.addIssue({
						code: "custom",
						path: [
							field,
						],
						message,
					});
			}
		}
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
