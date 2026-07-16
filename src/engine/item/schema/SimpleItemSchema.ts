import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item with no specialized gameplay behavior.
 */
export const SimpleItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Identifies this item as a simple stackable item.
		 */
		type: ItemEnumSchema.extract([
			"simple",
		]),
	})
	.strict()
	.meta({
		id: "SimpleItemSchema",
		description: "An item without specialized gameplay behavior.",
	});

export type SimpleItemSchema = typeof SimpleItemSchema;

export namespace SimpleItemSchema {
	export type Type = z.infer<SimpleItemSchema>;
}
