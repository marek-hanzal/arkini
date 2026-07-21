import { z } from "zod";

import { BlueprintItemSchema } from "./BlueprintItemSchema";
import { CraftItemSchema } from "./CraftItemSchema";
import { DepositItemSchema } from "./DepositItemSchema";
import { InventoryItemSchema } from "./InventoryItemSchema";
import { ProducerItemSchema } from "./ProducerItemSchema";
import { SimpleItemSchema } from "./SimpleItemSchema";
import { StashItemSchema } from "./StashItemSchema";
import { TemporaryItemSchema } from "./TemporaryItemSchema";

/**
 * An item configuration, resolved by its `type` discriminator.
 *
 * Each item kind owns its specialized shape while sharing the common base item
 * fields through its dedicated schema.
 */
export const ItemSchema = z
	.discriminatedUnion("type", [
		BlueprintItemSchema,
		DepositItemSchema,
		SimpleItemSchema,
		ProducerItemSchema,
		CraftItemSchema,
		StashItemSchema,
		TemporaryItemSchema,
		InventoryItemSchema,
	])
	.meta({
		id: "ItemSchema",
		description: "A game item selected by its type discriminator.",
	});

export type ItemSchema = typeof ItemSchema;

export namespace ItemSchema {
	export type Type = z.infer<ItemSchema>;
}
