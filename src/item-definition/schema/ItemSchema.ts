import { z } from "zod";

import { BlueprintSchema } from "./BlueprintSchema";
import { ClockSchema } from "./ClockSchema";
import { InventorySchema } from "./InventorySchema";
import { CommonSchema } from "./CommonSchema";
import { TemporarySchema } from "./TemporarySchema";
import { SpaceSchema } from "~/space-action/schema/SpaceSchema";

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
		SpaceSchema,
		ClockSchema,
		TemporarySchema,
		InventorySchema,
	])
	.meta({
		id: "ItemSchema",
		description: "A game item selected by its type discriminator.",
	});

export type ItemSchema = typeof ItemSchema;

export namespace ItemSchema {
	export type Type = z.infer<ItemSchema>;
}
