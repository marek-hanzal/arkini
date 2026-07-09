import { z } from "zod";

import { CheatInventoryItemSchema } from "./CheatInventoryItemSchema";
import { CheatSpeedOffItemSchema } from "./CheatSpeedOffItemSchema";
import { CheatSpeedOnItemSchema } from "./CheatSpeedOnItemSchema";
import { CraftItemSchema } from "./CraftItemSchema";
import { NukeItemSchema } from "./NukeItemSchema";
import { ProducerItemSchema } from "./ProducerItemSchema";
import { SimpleItemSchema } from "./SimpleItemSchema";
import { StashItemSchema } from "./StashItemSchema";

/**
 * An item configuration, resolved by its `type` discriminator.
 *
 * Each item kind owns its specialized shape while sharing the common base item
 * fields through its dedicated schema.
 */
export const ItemSchema = z
	.discriminatedUnion("type", [
		SimpleItemSchema,
		ProducerItemSchema,
		CraftItemSchema,
		StashItemSchema,
		CheatSpeedOnItemSchema,
		CheatSpeedOffItemSchema,
		NukeItemSchema,
		CheatInventoryItemSchema,
	])
	.describe("A game item selected by its type discriminator.");

export type ItemSchema = typeof ItemSchema;

export namespace ItemSchema {
	export type Type = z.infer<ItemSchema>;
}
